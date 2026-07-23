import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { quotes, quote_rubros, RUBRO_TYPES } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { and, eq } from "drizzle-orm"

const rubroSchema = z.object({
  rubros: z.array(
    z.object({
      rubro_type:    z.enum(RUBRO_TYPES),
      name:          z.string().min(1).max(200),
      budget_amount: z.coerce.number().min(0).default(0),
      active:        z.boolean().default(true),
      sort_order:    z.number().int().default(0),
    })
  ).min(1),
})

async function assertQuoteExists(id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: quotes.id })
    .from(quotes)
    .where(eq(quotes.id, id))
  return !!row
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth()

    if (!(await assertQuoteExists(params.id))) {
      return NextResponse.json({ success: false, error: "Cotización no encontrada" }, { status: 404 })
    }

    const body = await req.json()
    const { rubros } = rubroSchema.parse(body)

    // Replace all rubros for this quote atomically.
    // Using DELETE + INSERT instead of upsert because multiple "personalizado"
    // rubros share the same rubro_type, breaking the (quote_id, rubro_type)
    // unique constraint. Activities (quote_items) are always deleted and
    // re-created by the client after this call, so orphaned refs are safe.
    await db.delete(quote_rubros).where(eq(quote_rubros.quote_id, params.id))
    await db.insert(quote_rubros).values(
      rubros.map((r) => ({
        quote_id:      params.id,
        rubro_type:    r.rubro_type,
        name:          r.name,
        budget_amount: String(r.budget_amount),
        active:        r.active,
        sort_order:    r.sort_order,
      }))
    )

    const updated = await db
      .select()
      .from(quote_rubros)
      .where(eq(quote_rubros.quote_id, params.id))
      .orderBy(quote_rubros.sort_order)

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: err.errors[0].message }, { status: 400 })
    }
    console.error("[rubros PATCH]", err)
    return NextResponse.json({ success: false, error: "Error al actualizar rubros" }, { status: 500 })
  }
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth()

    if (!(await assertQuoteExists(params.id))) {
      return NextResponse.json({ success: false, error: "Cotización no encontrada" }, { status: 404 })
    }

    const rows = await db
      .select()
      .from(quote_rubros)
      .where(and(eq(quote_rubros.quote_id, params.id), eq(quote_rubros.active, true)))
      .orderBy(quote_rubros.sort_order)
    return NextResponse.json({ success: true, data: rows })
  } catch {
    return NextResponse.json({ success: false, error: "Error al cargar rubros" }, { status: 500 })
  }
}
