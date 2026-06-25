import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { projects } from "@/lib/db/schema"
import { requireAuth, requireRole } from "@/lib/auth"
import { and, desc, eq, isNull } from "drizzle-orm"
import { seedProjectRubros } from "@/lib/rubros"

export async function GET(req: Request) {
  try {
    await requireAuth()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")

    const rows = await db
      .select()
      .from(projects)
      .where(
        and(
          isNull(projects.deleted_at),
          status && status !== "all"
            ? eq(projects.status, status as "active" | "paused" | "completed" | "in_warranty" | "cancelled")
            : undefined
        )
      )
      .orderBy(desc(projects.created_at))

    return NextResponse.json({ success: true, data: rows })
  } catch {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
  }
}

const createSchema = z.object({
  client_id: z.string().uuid("Selecciona un cliente"),
  name: z.string().min(3, "Mínimo 3 caracteres"),
  description: z.string().optional(),
  quoted_amount: z.coerce.number().positive("El valor debe ser positivo"),
  advance_percentage: z.coerce.number().min(0).max(100).default(50),
  contingency_percentage: z.coerce.number().min(0).max(100).default(15),
  start_date: z.string().min(1, "Selecciona una fecha"),
  estimated_end_date: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const user = await requireRole(["admin", "accountant"])
    const body = await req.json()
    const data = createSchema.parse(body)

    const project = await db.transaction(async (tx) => {
      const [p] = await tx
        .insert(projects)
        .values({
          client_id: data.client_id,
          name: data.name,
          description: data.description || null,
          quoted_amount: String(data.quoted_amount),
          advance_percentage: String(data.advance_percentage),
          contingency_percentage: String(data.contingency_percentage),
          start_date: data.start_date,
          estimated_end_date: data.estimated_end_date || null,
          created_by: user.id,
        })
        .returning({ id: projects.id, name: projects.name })

      await seedProjectRubros(tx, p.id)
      return p
    })

    return NextResponse.json({ success: true, data: project }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: "Error al crear proyecto" }, { status: 500 })
  }
}
