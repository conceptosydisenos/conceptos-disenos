import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { quotes, quote_items } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { and, eq, isNull } from "drizzle-orm"
import { z } from "zod"
import { calculateQuoteTotals } from "@/lib/calculations"

const schema = z.object({
  category:   z.enum(["materiales", "mano_obra", "equipos", "imprevistos", "otro"]),
  name:       z.string().min(1).max(300),
  description:z.string().max(500).optional(),
  unit:       z.string().min(1).max(20),
  quantity:   z.coerce.number().positive(),
  unit_price: z.coerce.number().positive(),
  sort_order: z.coerce.number().default(0),
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAuth()

    const [quote] = await db
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, params.id), isNull(quotes.deleted_at)))

    if (!quote) return NextResponse.json({ success: false, error: "Cotización no encontrada" }, { status: 404 })
    if (quote.status !== "draft") return NextResponse.json({ success: false, error: "Solo se pueden editar cotizaciones en borrador" }, { status: 409 })

    const body: unknown = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ success: false, error: "Datos inválidos" }, { status: 400 })

    const d = parsed.data
    const total_price = d.quantity * d.unit_price

    const [item] = await db
      .insert(quote_items)
      .values({
        quote_id:    params.id,
        category:    d.category,
        name:        d.name,
        description: d.description ?? null,
        unit:        d.unit,
        quantity:    String(d.quantity),
        unit_price:  String(d.unit_price),
        total_price: String(total_price),
        sort_order:  d.sort_order,
      })
      .returning()

    // Recalculate and update quote totals
    const allItems = await db
      .select({ total_price: quote_items.total_price })
      .from(quote_items)
      .where(eq(quote_items.quote_id, params.id))

    const totals = calculateQuoteTotals(
      allItems,
      parseFloat(quote.discount_percentage),
      parseFloat(quote.tax_percentage),
      parseFloat(quote.advance_percentage)
    )

    await db
      .update(quotes)
      .set({
        subtotal_amount: String(totals.subtotal_amount),
        discount_amount: String(totals.discount_amount),
        tax_amount:      String(totals.tax_amount),
        total_amount:    String(totals.total_amount),
        advance_amount:  String(totals.advance_amount),
      })
      .where(eq(quotes.id, params.id))

    return NextResponse.json({ success: true, data: item }, { status: 201 })
  } catch {
    return NextResponse.json({ success: false, error: "Error al agregar ítem" }, { status: 500 })
  }
}
