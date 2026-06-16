import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { work_cuts, work_cut_items, budget_items, projects, audit_logs } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { eq, and, max, sum } from "drizzle-orm"
import {
  calculateExecutedAmount,
  calculateAmortization,
  calculateNetToPay,
  calculateCumulativeProgress,
} from "@/lib/calculations"

export async function GET(req: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(req.url)
    const project_id = searchParams.get("project_id")
    if (!project_id) {
      return NextResponse.json({ success: false, error: "project_id requerido" }, { status: 400 })
    }

    const cuts = await db
      .select({
        id: work_cuts.id,
        cut_number: work_cuts.cut_number,
        cut_date: work_cuts.cut_date,
        status: work_cuts.status,
        progress_percentage: work_cuts.progress_percentage,
        total_executed: work_cuts.total_executed,
        advance_amortization: work_cuts.advance_amortization,
        amount_to_pay: work_cuts.amount_to_pay,
        notes: work_cuts.notes,
        created_at: work_cuts.created_at,
      })
      .from(work_cuts)
      .where(eq(work_cuts.project_id, project_id))
      .orderBy(work_cuts.cut_number)

    return NextResponse.json({ success: true, data: cuts })
  } catch {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
  }
}

const createSchema = z.object({
  project_id: z.string().uuid(),
  cut_date: z.string().min(1, "Fecha requerida"),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        budget_item_id: z.string().uuid(),
        progress_percentage: z.coerce.number().min(0).max(100),
      })
    )
    .min(1, "Debes registrar progreso en al menos una actividad"),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const data = createSchema.parse(body)

    // 1. Block if there's an existing draft for this project
    const [existingDraft] = await db
      .select({ id: work_cuts.id, cut_number: work_cuts.cut_number })
      .from(work_cuts)
      .where(and(eq(work_cuts.project_id, data.project_id), eq(work_cuts.status, "draft")))
      .limit(1)

    if (existingDraft) {
      return NextResponse.json(
        {
          success: false,
          error: `Ya existe el Corte #${existingDraft.cut_number} en borrador. Complétalo antes de crear uno nuevo.`,
          data: { existing_draft_id: existingDraft.id },
        },
        { status: 409 }
      )
    }

    // 2. Fetch project (advance_percentage, quoted_amount)
    const [project] = await db
      .select({ advance_percentage: projects.advance_percentage, quoted_amount: projects.quoted_amount })
      .from(projects)
      .where(eq(projects.id, data.project_id))

    if (!project) {
      return NextResponse.json({ success: false, error: "Proyecto no encontrado" }, { status: 404 })
    }

    // 3. Fetch budget items for validation and calculation
    const budgetItemRecords = await db
      .select({ id: budget_items.id, total_price: budget_items.total_price })
      .from(budget_items)
      .where(eq(budget_items.project_id, data.project_id))

    if (budgetItemRecords.length === 0) {
      return NextResponse.json(
        { success: false, error: "Este proyecto no tiene ítems de presupuesto." },
        { status: 400 }
      )
    }

    // 4. Filter items with non-zero progress only
    const nonZeroItems = data.items.filter((i) => i.progress_percentage > 0)
    if (nonZeroItems.length === 0) {
      return NextResponse.json(
        { success: false, error: "Debes registrar al menos una actividad con progreso mayor a 0%." },
        { status: 400 }
      )
    }

    // 5. Calculate financials
    const totalExecuted = calculateExecutedAmount(
      budgetItemRecords,
      nonZeroItems.map((i) => ({ budget_item_id: i.budget_item_id, progress_percentage: i.progress_percentage }))
    )
    const advancePct = parseFloat(String(project.advance_percentage))
    const amortization = calculateAmortization(totalExecuted, advancePct)
    const amountToPay = calculateNetToPay(totalExecuted, amortization)

    // 6. Compute cumulative progress for this cut
    const [sumResult] = await db
      .select({ total: sum(work_cuts.total_executed) })
      .from(work_cuts)
      .where(and(eq(work_cuts.project_id, data.project_id), eq(work_cuts.status, "approved")))

    const previouslyExecuted = parseFloat(String(sumResult?.total ?? "0"))
    const cumulativeExecuted = previouslyExecuted + totalExecuted
    const cumulativeProgress = calculateCumulativeProgress(
      [cumulativeExecuted],
      project.quoted_amount
    )

    // 7. Get next cut number
    const [maxResult] = await db
      .select({ maxNum: max(work_cuts.cut_number) })
      .from(work_cuts)
      .where(eq(work_cuts.project_id, data.project_id))

    const nextCutNumber = (maxResult?.maxNum ?? 0) + 1

    // 8. Create work_cut
    const [cut] = await db
      .insert(work_cuts)
      .values({
        project_id: data.project_id,
        cut_number: nextCutNumber,
        cut_date: data.cut_date,
        status: "draft",
        progress_percentage: String(cumulativeProgress.toFixed(2)),
        total_executed: String(totalExecuted.toFixed(2)),
        advance_amortization: String(amortization.toFixed(2)),
        amount_to_pay: String(amountToPay.toFixed(2)),
        notes: data.notes || null,
        created_by: user.id,
      })
      .returning({ id: work_cuts.id, cut_number: work_cuts.cut_number })

    // 9. Create work_cut_items
    await db.insert(work_cut_items).values(
      nonZeroItems.map((item) => {
        const budgetItem = budgetItemRecords.find((b) => b.id === item.budget_item_id)
        const executedAmt = budgetItem
          ? (parseFloat(String(budgetItem.total_price)) * item.progress_percentage) / 100
          : 0
        return {
          work_cut_id: cut.id,
          budget_item_id: item.budget_item_id,
          progress_percentage: String(item.progress_percentage),
          executed_amount: String(executedAmt.toFixed(2)),
        }
      })
    )

    // 10. Audit log
    await db.insert(audit_logs).values({
      user_id: user.id,
      action: "create",
      entity_type: "work_cut",
      entity_id: cut.id,
      new_values: { cut_number: cut.cut_number, total_executed: totalExecuted, status: "draft" },
    })

    return NextResponse.json({ success: true, data: cut }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: err.errors[0].message }, { status: 400 })
    }
    console.error("Error creating work cut:", err)
    return NextResponse.json({ success: false, error: "Error al crear corte" }, { status: 500 })
  }
}
