import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { contractors, project_contractors, contractor_payments } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { eq, and, sum, count } from "drizzle-orm"

export async function GET(_req: NextRequest) {
  try {
    await requireAuth()

    const rows = await db
      .select({
        id: contractors.id,
        name: contractors.name,
        contractor_type: contractors.contractor_type,
        specialty: contractors.specialty,
        phone: contractors.phone,
        email: contractors.email,
        nit: contractors.nit,
        created_at: contractors.created_at,
      })
      .from(contractors)
      .orderBy(contractors.name)

    // Enrich each with active project count + pending payments total
    const enriched = await Promise.all(
      rows.map(async (c) => {
        const [projectStats] = await db
          .select({ activeCount: count() })
          .from(project_contractors)
          .where(and(eq(project_contractors.contractor_id, c.id), eq(project_contractors.status, "active")))

        const [pendingPayments] = await db
          .select({ total: sum(contractor_payments.amount) })
          .from(contractor_payments)
          .where(and(eq(contractor_payments.contractor_id, c.id), eq(contractor_payments.status, "pending")))

        return {
          ...c,
          active_projects: projectStats?.activeCount ?? 0,
          pending_amount: parseFloat(String(pendingPayments?.total ?? "0")),
        }
      })
    )

    return NextResponse.json({ success: true, data: enriched })
  } catch {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
  }
}

const createSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  contractor_type: z.enum(["persona_natural", "empresa"]).default("persona_natural"),
  specialty: z.string().min(1, "Especialidad requerida"),
  phone: z.string().min(7, "Teléfono requerido"),
  email: z.string().email().optional().or(z.literal("")),
  nit: z.string().optional(),
  bank_name: z.string().optional(),
  bank_account: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    await requireAuth()
    const body = await req.json()
    const data = createSchema.parse(body)

    const [contractor] = await db
      .insert(contractors)
      .values({
        name: data.name,
        contractor_type: data.contractor_type,
        specialty: data.specialty,
        phone: data.phone,
        email: data.email || null,
        nit: data.nit || null,
        bank_name: data.bank_name || null,
        bank_account: data.bank_account || null,
      })
      .returning({ id: contractors.id, name: contractors.name })

    return NextResponse.json({ success: true, data: contractor }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: "Error al crear contratista" }, { status: 500 })
  }
}
