import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { budget_items } from "@/lib/db/schema"
import { requireAuth, requireRole } from "@/lib/auth"
import { eq } from "drizzle-orm"

const createSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  category: z.enum(["materiales", "mano_obra", "equipos", "imprevistos", "otro"]),
  unit: z.string().min(1, "Unidad requerida"),
  quantity: z.coerce.number().positive("Cantidad debe ser mayor a 0"),
  unit_price: z.coerce.number().positive("Valor unitario debe ser mayor a 0"),
})

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAuth()
    const items = await db
      .select()
      .from(budget_items)
      .where(eq(budget_items.project_id, params.id))
      .orderBy(budget_items.category, budget_items.name)
    return NextResponse.json({ success: true, data: items })
  } catch {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(["admin", "accountant"])
    const body = await req.json()
    const data = createSchema.parse(body)
    const total_price = data.quantity * data.unit_price

    const [item] = await db
      .insert(budget_items)
      .values({
        project_id: params.id,
        name: data.name,
        category: data.category,
        unit: data.unit,
        quantity: String(data.quantity),
        unit_price: String(data.unit_price),
        total_price: String(total_price),
      })
      .returning()

    return NextResponse.json({ success: true, data: item }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: "Error al crear ítem" }, { status: 500 })
  }
}
