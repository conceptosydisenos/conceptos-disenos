import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { project_extras } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { eq, isNull, desc } from "drizzle-orm"

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth()
    const rows = await db
      .select()
      .from(project_extras)
      .where(eq(project_extras.project_id, params.id))
      .orderBy(desc(project_extras.created_at))
    return NextResponse.json({ success: true, data: rows })
  } catch {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
  }
}

const createSchema = z.object({
  description: z.string().min(3, "Mínimo 3 caracteres"),
  value: z.coerce.number().positive("El valor debe ser mayor a 0"),
  reason: z.string().min(3, "Explica brevemente el motivo"),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const data = createSchema.parse(body)

    const [extra] = await db
      .insert(project_extras)
      .values({
        project_id: params.id,
        description: data.description,
        value: String(data.value),
        reason: data.reason,
        status: "pending",
        created_by: user.id,
      })
      .returning()

    return NextResponse.json({ success: true, data: extra }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: "Error al registrar adicional" }, { status: 500 })
  }
}
