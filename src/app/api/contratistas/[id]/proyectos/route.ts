import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { project_contractors, contractors, projects } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { and, eq } from "drizzle-orm"

const schema = z.object({
  project_id: z.string().uuid("Proyecto inválido"),
  contract_amount: z.coerce.number().positive("El monto contratado debe ser mayor a 0"),
  start_date: z.string().min(1, "Fecha de inicio requerida"),
  end_date: z.string().optional(),
  payment_modality: z.enum(["quincenal", "por_actividad"]).default("quincenal"),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth()

    const [contractor] = await db
      .select({ id: contractors.id })
      .from(contractors)
      .where(eq(contractors.id, params.id))

    if (!contractor) {
      return NextResponse.json({ success: false, error: "Contratista no encontrado" }, { status: 404 })
    }

    const body = await req.json()
    const data = schema.parse(body)

    // Check not already linked (active)
    const [existing] = await db
      .select({ id: project_contractors.id })
      .from(project_contractors)
      .where(
        and(
          eq(project_contractors.contractor_id, params.id),
          eq(project_contractors.project_id, data.project_id),
          eq(project_contractors.status, "active")
        )
      )

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Este contratista ya está vinculado a ese proyecto." },
        { status: 409 }
      )
    }

    const [pc] = await db
      .insert(project_contractors)
      .values({
        contractor_id: params.id,
        project_id: data.project_id,
        contract_amount: String(data.contract_amount),
        start_date: data.start_date,
        end_date: data.end_date || null,
        payment_modality: data.payment_modality,
        status: "active",
      })
      .returning({ id: project_contractors.id })

    return NextResponse.json({ success: true, data: pc }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: "Error al vincular contratista" }, { status: 500 })
  }
}
