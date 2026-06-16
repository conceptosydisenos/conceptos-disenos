import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { work_cuts, work_cut_items, budget_items, projects } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { eq } from "drizzle-orm"
import {
  calculateExecutedAmount,
  calculateAmortization,
  calculateNetToPay,
} from "@/lib/calculations"

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth()

    const [cut] = await db.select().from(work_cuts).where(eq(work_cuts.id, params.id))
    if (!cut) {
      return NextResponse.json({ success: false, error: "Corte no encontrado" }, { status: 404 })
    }

    const items = await db
      .select({
        id: work_cut_items.id,
        budget_item_id: work_cut_items.budget_item_id,
        progress_percentage: work_cut_items.progress_percentage,
        executed_amount: work_cut_items.executed_amount,
        item_name: budget_items.name,
        item_unit: budget_items.unit,
        item_category: budget_items.category,
        item_total_price: budget_items.total_price,
      })
      .from(work_cut_items)
      .leftJoin(budget_items, eq(work_cut_items.budget_item_id, budget_items.id))
      .where(eq(work_cut_items.work_cut_id, params.id))

    return NextResponse.json({ success: true, data: { ...cut, items } })
  } catch {
    return NextResponse.json({ success: false, error: "Error al cargar corte" }, { status: 500 })
  }
}

const updateSchema = z.object({
  cut_date: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        budget_item_id: z.string().uuid(),
        progress_percentage: z.coerce.number().min(0).max(100),
      })
    )
    .optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuth()

    const [cut] = await db
      .select({ id: work_cuts.id, status: work_cuts.status, project_id: work_cuts.project_id })
      .from(work_cuts)
      .where(eq(work_cuts.id, params.id))

    if (!cut) {
      return NextResponse.json({ success: false, error: "Corte no encontrado" }, { status: 404 })
    }

    // IMMUTABILITY: approved cuts cannot be modified
    if (cut.status === "approved") {
      return NextResponse.json(
        { success: false, error: "Este corte ya fue aprobado y es inmutable." },
        { status: 409 }
      )
    }

    const body = await req.json()
    const data = updateSchema.parse(body)

    if (data.items && data.items.length > 0) {
      const nonZero = data.items.filter((i) => i.progress_percentage > 0)

      const [proj] = await db
        .select({ advance_percentage: projects.advance_percentage })
        .from(projects)
        .where(eq(projects.id, cut.project_id))

      const projectItems = await db
        .select({ id: budget_items.id, total_price: budget_items.total_price })
        .from(budget_items)
        .where(eq(budget_items.project_id, cut.project_id))

      const totalExecuted = calculateExecutedAmount(
        projectItems,
        nonZero.map((i) => ({ budget_item_id: i.budget_item_id, progress_percentage: i.progress_percentage }))
      )
      const amortization = calculateAmortization(totalExecuted, parseFloat(String(proj.advance_percentage)))
      const amountToPay = calculateNetToPay(totalExecuted, amortization)

      await db.delete(work_cut_items).where(eq(work_cut_items.work_cut_id, params.id))

      if (nonZero.length > 0) {
        await db.insert(work_cut_items).values(
          nonZero.map((item) => {
            const bi = projectItems.find((b) => b.id === item.budget_item_id)
            const executed = bi
              ? (parseFloat(String(bi.total_price)) * item.progress_percentage) / 100
              : 0
            return {
              work_cut_id: params.id,
              budget_item_id: item.budget_item_id,
              progress_percentage: String(item.progress_percentage),
              executed_amount: String(executed.toFixed(2)),
            }
          })
        )
      }

      await db
        .update(work_cuts)
        .set({
          total_executed: totalExecuted.toFixed(2),
          advance_amortization: amortization.toFixed(2),
          amount_to_pay: amountToPay.toFixed(2),
          ...(data.cut_date && { cut_date: data.cut_date }),
          ...(data.notes !== undefined && { notes: data.notes || null }),
        })
        .where(eq(work_cuts.id, params.id))
    } else if (data.cut_date || data.notes !== undefined) {
      await db
        .update(work_cuts)
        .set({
          ...(data.cut_date ? { cut_date: data.cut_date } : {}),
          ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
        })
        .where(eq(work_cuts.id, params.id))
    }

    const [updated] = await db.select().from(work_cuts).where(eq(work_cuts.id, params.id))
    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: "Error al actualizar corte" }, { status: 500 })
  }
}
