import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { contractors, project_contractors, contractor_payments, projects } from "@/lib/db/schema"
import { requireAuth, requireRole } from "@/lib/auth"
import { eq, and, sum, desc, count } from "drizzle-orm"

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth()

    const [contractor] = await db
      .select()
      .from(contractors)
      .where(eq(contractors.id, params.id))

    if (!contractor) {
      return NextResponse.json({ success: false, error: "Contratista no encontrado" }, { status: 404 })
    }

    // Active projects with financial summary
    const linkedProjects = await db
      .select({
        pc_id: project_contractors.id,
        project_id: project_contractors.project_id,
        contract_amount: project_contractors.contract_amount,
        payment_modality: project_contractors.payment_modality,
        status: project_contractors.status,
        start_date: project_contractors.start_date,
        end_date: project_contractors.end_date,
        project_name: projects.name,
        project_status: projects.status,
      })
      .from(project_contractors)
      .leftJoin(projects, eq(project_contractors.project_id, projects.id))
      .where(eq(project_contractors.contractor_id, params.id))
      .orderBy(project_contractors.start_date)

    // Payments per project
    const projectsWithBalance = await Promise.all(
      linkedProjects.map(async (pc) => {
        const [paid] = await db
          .select({ total: sum(contractor_payments.amount) })
          .from(contractor_payments)
          .where(
            and(
              eq(contractor_payments.contractor_id, params.id),
              eq(contractor_payments.project_id, pc.project_id!),
              eq(contractor_payments.status, "paid")
            )
          )
        const [pending] = await db
          .select({ total: sum(contractor_payments.amount) })
          .from(contractor_payments)
          .where(
            and(
              eq(contractor_payments.contractor_id, params.id),
              eq(contractor_payments.project_id, pc.project_id!),
              eq(contractor_payments.status, "pending")
            )
          )

        const contractAmount = parseFloat(String(pc.contract_amount))
        const totalPaid = parseFloat(String(paid?.total ?? "0"))
        const pendingAmount = parseFloat(String(pending?.total ?? "0"))

        return {
          ...pc,
          total_paid: totalPaid,
          pending_registered: pendingAmount,
          balance: contractAmount - totalPaid,
        }
      })
    )

    // Recent payment history
    const recentPayments = await db
      .select({
        id: contractor_payments.id,
        amount: contractor_payments.amount,
        payment_date: contractor_payments.payment_date,
        payment_method: contractor_payments.payment_method,
        reference_number: contractor_payments.reference_number,
        status: contractor_payments.status,
        notes: contractor_payments.notes,
        project_id: contractor_payments.project_id,
        project_name: projects.name,
      })
      .from(contractor_payments)
      .leftJoin(projects, eq(contractor_payments.project_id, projects.id))
      .where(eq(contractor_payments.contractor_id, params.id))
      .orderBy(desc(contractor_payments.payment_date))
      .limit(20)

    return NextResponse.json({
      success: true,
      data: { ...contractor, projects: projectsWithBalance, payments: recentPayments },
    })
  } catch {
    return NextResponse.json({ success: false, error: "Error al cargar contratista" }, { status: 500 })
  }
}

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  contractor_type: z.enum(["persona_natural", "empresa"]).optional(),
  specialty: z.string().min(1).optional(),
  phone: z.string().min(7).optional(),
  email: z.string().email().optional().or(z.literal("")),
  nit: z.string().optional(),
  bank_name: z.string().optional(),
  bank_account: z.string().optional(),
  archived: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth()
    const body = await req.json()
    const data = updateSchema.parse(body)

    await db
      .update(contractors)
      .set({
        ...(data.name && { name: data.name }),
        ...(data.contractor_type && { contractor_type: data.contractor_type }),
        ...(data.specialty && { specialty: data.specialty }),
        ...(data.phone && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email || null }),
        ...(data.nit !== undefined && { nit: data.nit || null }),
        ...(data.bank_name !== undefined && { bank_name: data.bank_name || null }),
        ...(data.bank_account !== undefined && { bank_account: data.bank_account || null }),
        ...(data.archived !== undefined && { archived: data.archived }),
        updated_at: new Date(),
      })
      .where(eq(contractors.id, params.id))

    const [updated] = await db.select().from(contractors).where(eq(contractors.id, params.id))
    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: "Error al actualizar contratista" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"])

    const [contractor] = await db
      .select({ archived: contractors.archived })
      .from(contractors)
      .where(eq(contractors.id, params.id))

    if (!contractor) return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 })
    if (!contractor.archived) {
      return NextResponse.json(
        { success: false, error: "Debes archivar el contratista antes de eliminarlo" },
        { status: 400 }
      )
    }

    const [{ total: projectTotal }] = await db
      .select({ total: count() })
      .from(project_contractors)
      .where(eq(project_contractors.contractor_id, params.id))

    if (projectTotal > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Este contratista tiene ${projectTotal} proyecto${projectTotal !== 1 ? "s" : ""} vinculado${projectTotal !== 1 ? "s" : ""}. Desvincula los proyectos primero.`,
        },
        { status: 400 }
      )
    }

    await db.delete(contractors).where(eq(contractors.id, params.id))
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: "Error al eliminar contratista" }, { status: 500 })
  }
}
