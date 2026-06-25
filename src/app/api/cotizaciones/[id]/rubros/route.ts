import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { quote_rubros, RUBRO_TYPES } from "@/lib/db/schema"
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

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth()
    const body = await req.json()
    const { rubros } = rubroSchema.parse(body)

    // Upsert each rubro by (quote_id, rubro_type).
    // The unique index on (quote_id, rubro_type) makes this safe.
    await Promise.all(
      rubros.map((r) =>
        db
          .insert(quote_rubros)
          .values({
            quote_id:      params.id,
            rubro_type:    r.rubro_type,
            name:          r.name,
            budget_amount: String(r.budget_amount),
            active:        r.active,
            sort_order:    r.sort_order,
          })
          .onConflictDoUpdate({
            target: [quote_rubros.quote_id, quote_rubros.rubro_type],
            set: {
              name:          r.name,
              budget_amount: String(r.budget_amount),
              active:        r.active,
              sort_order:    r.sort_order,
              updated_at:    new Date(),
            },
          })
      )
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
    return NextResponse.json({ success: false, error: "Error al actualizar rubros" }, { status: 500 })
  }
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth()
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
