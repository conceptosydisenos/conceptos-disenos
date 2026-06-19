import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { projects, advances, invoice_allocations, clients } from "@/lib/db/schema"
import { requireAuth, requireRole } from "@/lib/auth"
import { and, eq, isNull, sql } from "drizzle-orm"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAuth()

    const [project] = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        status: projects.status,
        start_date: projects.start_date,
        estimated_end_date: projects.estimated_end_date,
        actual_end_date: projects.actual_end_date,
        quoted_amount: projects.quoted_amount,
        advance_percentage: projects.advance_percentage,
        contingency_percentage: projects.contingency_percentage,
        client_name: clients.name,
        client_nit: clients.nit,
        created_at: projects.created_at,
      })
      .from(projects)
      .leftJoin(clients, eq(projects.client_id, clients.id))
      .where(and(eq(projects.id, params.id), isNull(projects.deleted_at)))

    if (!project) {
      return NextResponse.json({ success: false, error: "Proyecto no encontrado" }, { status: 404 })
    }

    const [advancesResult] = await db
      .select({ total: sql<string>`coalesce(sum(amount), 0)` })
      .from(advances)
      .where(eq(advances.project_id, params.id))

    const [invoiceCostResult] = await db
      .select({ total: sql<string>`coalesce(sum(amount), 0)` })
      .from(invoice_allocations)
      .where(eq(invoice_allocations.project_id, params.id))

    const quoted = parseFloat(project.quoted_amount)
    const contingencyPct = parseFloat(project.contingency_percentage)
    const totalAdvances = parseFloat(advancesResult.total)
    const totalInvoiceCost = parseFloat(invoiceCostResult.total)
    const contingencyAmount = (quoted * contingencyPct) / 100
    const availableMargin = quoted - contingencyAmount - totalInvoiceCost
    const projectedReturn = quoted > 0 ? (availableMargin / quoted) * 100 : 0
    const pendingBalance = quoted - totalAdvances

    return NextResponse.json({
      success: true,
      data: {
        ...project,
        financial: {
          quoted_amount: quoted,
          total_advances: totalAdvances,
          pending_balance: pendingBalance,
          total_invoice_cost: totalInvoiceCost,
          contingency_amount: contingencyAmount,
          available_margin: availableMargin,
          projected_return_pct: projectedReturn,
        },
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: "Error al cargar proyecto" }, { status: 500 })
  }
}

const patchSchema = z.object({
  status: z.enum(["active", "paused", "completed", "in_warranty", "cancelled"]).optional(),
  actual_end_date: z.string().optional().nullable(),
  name: z.string().min(3).optional(),
  description: z.string().optional().nullable(),
  client_id: z.string().uuid().optional(),
  quoted_amount: z.coerce.number().positive().optional(),
  advance_percentage: z.coerce.number().min(0).max(100).optional(),
  contingency_percentage: z.coerce.number().min(0).max(100).optional(),
  start_date: z.string().optional(),
  estimated_end_date: z.string().optional().nullable(),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"])
    const body = await req.json()
    const data = patchSchema.parse(body)

    const [updated] = await db
      .update(projects)
      .set({
        updated_at: new Date(),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.actual_end_date !== undefined && { actual_end_date: data.actual_end_date }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.client_id !== undefined && { client_id: data.client_id }),
        ...(data.quoted_amount !== undefined && { quoted_amount: String(data.quoted_amount) }),
        ...(data.advance_percentage !== undefined && { advance_percentage: String(data.advance_percentage) }),
        ...(data.contingency_percentage !== undefined && { contingency_percentage: String(data.contingency_percentage) }),
        ...(data.start_date !== undefined && { start_date: data.start_date }),
        ...(data.estimated_end_date !== undefined && {
          estimated_end_date: data.estimated_end_date || null,
        }),
      })
      .where(and(eq(projects.id, params.id), isNull(projects.deleted_at)))
      .returning({ id: projects.id, status: projects.status })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: "Error al actualizar" }, { status: 500 })
  }
}
