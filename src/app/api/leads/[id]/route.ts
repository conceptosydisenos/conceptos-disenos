import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { leads, lead_activities } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { and, desc, eq, isNull } from "drizzle-orm"
import { z } from "zod"

const patchSchema = z.object({
  contact_name: z.string().min(1).max(200).optional(),
  contact_phone: z.string().min(1).max(50).optional(),
  contact_email: z.string().email().optional().or(z.literal("")).optional(),
  project_description: z.string().min(1).max(2000).optional(),
  project_address: z.string().max(500).optional(),
  estimated_value: z.coerce.number().positive().optional().nullable(),
  source: z.enum(["referido", "voz_a_voz", "volante", "aliado", "web", "redes", "whatsapp", "llamada_directa", "otro"]).optional(),
  status: z.enum(["new", "contacted", "visit_scheduled", "quoted", "won", "lost"]).optional(),
  notes: z.string().max(2000).optional(),
  next_follow_up_at: z.string().datetime({ offset: true }).optional().nullable(),
  lost_reason: z.string().max(500).optional(),
})

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAuth()

    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, params.id), isNull(leads.deleted_at)))

    if (!lead) {
      return NextResponse.json({ success: false, error: "Lead no encontrado" }, { status: 404 })
    }

    const activities = await db
      .select()
      .from(lead_activities)
      .where(eq(lead_activities.lead_id, params.id))
      .orderBy(desc(lead_activities.occurred_at))

    return NextResponse.json({ success: true, data: { ...lead, activities } })
  } catch {
    return NextResponse.json({ success: false, error: "Error al cargar lead" }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth()

    const body: unknown = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Datos inválidos" }, { status: 400 })
    }

    const leadFilter = user.role === "admin"
      ? and(eq(leads.id, params.id), isNull(leads.deleted_at))
      : and(eq(leads.id, params.id), eq(leads.assigned_to, user.id), isNull(leads.deleted_at))

    const [existing] = await db
      .select({ id: leads.id, status: leads.status })
      .from(leads)
      .where(leadFilter)

    if (!existing) {
      return NextResponse.json({ success: false, error: "Lead no encontrado" }, { status: 404 })
    }

    const { estimated_value, status, contact_email, next_follow_up_at, ...rest } = parsed.data

    const updatePayload: Record<string, unknown> = { ...rest }
    if (estimated_value !== undefined) {
      updatePayload.estimated_value = estimated_value != null ? String(estimated_value) : null
    }
    if (contact_email !== undefined) {
      updatePayload.contact_email = contact_email || null
    }
    if (next_follow_up_at !== undefined) {
      updatePayload.next_follow_up_at = next_follow_up_at ? new Date(next_follow_up_at) : null
    }
    if (status !== undefined) {
      updatePayload.status = status
      if (status === "won" || status === "lost") {
        updatePayload.closed_at = new Date()
      }
    }

    const [updated] = await db
      .update(leads)
      .set(updatePayload)
      .where(leadFilter)
      .returning()

    // Log status change activity automatically
    if (status !== undefined && status !== existing.status) {
      await db.insert(lead_activities).values({
        lead_id: params.id,
        activity_type: "cambio_estado",
        summary: `Estado cambiado a ${STATUS_LABELS[status] ?? status}`,
        previous_status: existing.status,
        new_status: status,
        created_by: user.id,
      })
    }

    return NextResponse.json({ success: true, data: updated })
  } catch {
    return NextResponse.json({ success: false, error: "Error al actualizar lead" }, { status: 500 })
  }
}

const STATUS_LABELS: Record<string, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  visit_scheduled: "Visita agendada",
  quoted: "Cotización enviada",
  won: "Ganado",
  lost: "Perdido",
}
