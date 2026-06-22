import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { quotes, quote_items } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { and, asc, eq, isNull } from "drizzle-orm"
import { z } from "zod"
import { calculateQuoteTotals } from "@/lib/calculations"

const patchSchema = z.object({
  project_name:           z.string().min(1).max(300).optional(),
  description:            z.string().max(2000).optional(),
  contact_name:           z.string().max(200).optional(),
  contact_phone:          z.string().max(50).optional(),
  contact_email:          z.string().email().optional().or(z.literal("")).optional(),
  valid_until:            z.string().min(1).optional(),
  discount_percentage:    z.coerce.number().min(0).max(100).optional(),
  tax_percentage:         z.coerce.number().min(0).max(100).optional(),
  advance_percentage:     z.coerce.number().min(0).max(100).optional(),
  contingency_percentage: z.coerce.number().min(0).max(100).optional(),
})

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAuth()

    const [quote] = await db
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, params.id), isNull(quotes.deleted_at)))

    if (!quote) {
      return NextResponse.json({ success: false, error: "Cotización no encontrada" }, { status: 404 })
    }

    const items = await db
      .select()
      .from(quote_items)
      .where(eq(quote_items.quote_id, params.id))
      .orderBy(asc(quote_items.sort_order), asc(quote_items.created_at))

    return NextResponse.json({ success: true, data: { ...quote, items } })
  } catch {
    return NextResponse.json({ success: false, error: "Error al cargar cotización" }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAuth()

    const body: unknown = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Datos inválidos" }, { status: 400 })
    }

    const [existing] = await db
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, params.id), isNull(quotes.deleted_at)))

    if (!existing) {
      return NextResponse.json({ success: false, error: "Cotización no encontrada" }, { status: 404 })
    }

    const d = parsed.data
    const discPct = d.discount_percentage ?? parseFloat(existing.discount_percentage)
    const taxPct  = d.tax_percentage      ?? parseFloat(existing.tax_percentage)
    const advPct  = d.advance_percentage  ?? parseFloat(existing.advance_percentage)

    // Recalculate totals from current items + new percentages
    const items = await db
      .select({ total_price: quote_items.total_price })
      .from(quote_items)
      .where(eq(quote_items.quote_id, params.id))

    const totals = calculateQuoteTotals(items, discPct, taxPct, advPct)

    const update: Record<string, unknown> = {
      ...( d.project_name           !== undefined && { project_name: d.project_name }),
      ...( d.description            !== undefined && { description: d.description }),
      ...( d.contact_name           !== undefined && { contact_name: d.contact_name }),
      ...( d.contact_phone          !== undefined && { contact_phone: d.contact_phone }),
      ...( d.contact_email          !== undefined && { contact_email: d.contact_email || null }),
      ...( d.valid_until            !== undefined && { valid_until: d.valid_until }),
      ...( d.contingency_percentage !== undefined && { contingency_percentage: String(d.contingency_percentage) }),
      discount_percentage: String(discPct),
      tax_percentage:      String(taxPct),
      advance_percentage:  String(advPct),
      subtotal_amount:     String(totals.subtotal_amount),
      discount_amount:     String(totals.discount_amount),
      tax_amount:          String(totals.tax_amount),
      total_amount:        String(totals.total_amount),
      advance_amount:      String(totals.advance_amount),
    }

    const [updated] = await db
      .update(quotes)
      .set(update)
      .where(eq(quotes.id, params.id))
      .returning()

    return NextResponse.json({ success: true, data: updated })
  } catch {
    return NextResponse.json({ success: false, error: "Error al actualizar cotización" }, { status: 500 })
  }
}
