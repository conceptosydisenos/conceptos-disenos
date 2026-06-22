import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { lead_activities, leads } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { and, eq, isNull } from "drizzle-orm"
import { z } from "zod"

const schema = z.object({
  activity_type: z.enum(["llamada", "email", "visita", "whatsapp", "nota", "cotizacion_enviada", "cambio_estado"]),
  summary: z.string().min(1).max(1000),
  outcome: z.string().max(500).optional(),
  occurred_at: z.string().datetime({ offset: true }).optional(),
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth()

    const body: unknown = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Datos inválidos" }, { status: 400 })
    }

    const [lead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, params.id), isNull(leads.deleted_at)))

    if (!lead) {
      return NextResponse.json({ success: false, error: "Lead no encontrado" }, { status: 404 })
    }

    const [activity] = await db
      .insert(lead_activities)
      .values({
        lead_id: params.id,
        activity_type: parsed.data.activity_type,
        summary: parsed.data.summary,
        outcome: parsed.data.outcome ?? null,
        occurred_at: parsed.data.occurred_at ? new Date(parsed.data.occurred_at) : new Date(),
        created_by: user.id,
      })
      .returning()

    return NextResponse.json({ success: true, data: activity }, { status: 201 })
  } catch {
    return NextResponse.json({ success: false, error: "Error al registrar actividad" }, { status: 500 })
  }
}
