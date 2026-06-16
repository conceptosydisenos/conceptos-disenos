import { db } from "@/lib/db"
import { projects, budget_items, work_cuts, work_cut_items } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { eq, and, sum } from "drizzle-orm"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { CorteForm } from "@/components/cortes/CorteForm"
import type { BudgetItemWithContext } from "@/components/cortes/CorteForm"

interface Props {
  params: { id: string }
}

export default async function NuevoCorte({ params }: Props) {
  await requireAuth()

  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      quoted_amount: projects.quoted_amount,
      advance_percentage: projects.advance_percentage,
    })
    .from(projects)
    .where(eq(projects.id, params.id))

  if (!project) notFound()

  // Block if existing draft
  const [existingDraft] = await db
    .select({ id: work_cuts.id })
    .from(work_cuts)
    .where(and(eq(work_cuts.project_id, params.id), eq(work_cuts.status, "draft")))
    .limit(1)

  if (existingDraft) {
    redirect(`/dashboard/proyectos/${params.id}/cortes/${existingDraft.id}`)
  }

  const projectBudgetItems = await db
    .select()
    .from(budget_items)
    .where(eq(budget_items.project_id, params.id))
    .orderBy(budget_items.category, budget_items.name)

  if (projectBudgetItems.length === 0) {
    return (
      <div className="p-4 md:p-6 max-w-lg mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/proyectos/${params.id}/cortes`} className="text-muted-foreground hover:text-foreground p-1 -m-1">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-bold">Nuevo corte</h1>
        </div>
        <div className="section-card text-center py-12 space-y-3">
          <p className="text-sm font-medium text-muted-foreground">
            Este proyecto no tiene ítems de presupuesto
          </p>
          <p className="text-xs text-muted-foreground">
            Agrega actividades al presupuesto antes de registrar un corte de avance.
          </p>
          <Link href={`/dashboard/proyectos/${params.id}`} className="text-sm text-primary font-medium block mt-2">
            Volver al proyecto →
          </Link>
        </div>
      </div>
    )
  }

  // Get cumulative progress per item from approved cuts
  const approvedItemProgress = await db
    .select({
      budget_item_id: work_cut_items.budget_item_id,
      total_pct: sum(work_cut_items.progress_percentage),
    })
    .from(work_cut_items)
    .innerJoin(work_cuts, eq(work_cut_items.work_cut_id, work_cuts.id))
    .where(and(eq(work_cuts.project_id, params.id), eq(work_cuts.status, "approved")))
    .groupBy(work_cut_items.budget_item_id)

  const progressMap = new Map(
    approvedItemProgress.map((r) => [r.budget_item_id, parseFloat(String(r.total_pct ?? "0"))])
  )

  // Cumulative executed from approved cuts for the progress bar
  const [approvedSum] = await db
    .select({ total: sum(work_cuts.total_executed) })
    .from(work_cuts)
    .where(and(eq(work_cuts.project_id, params.id), eq(work_cuts.status, "approved")))

  const previouslyExecuted = parseFloat(String(approvedSum?.total ?? "0"))

  const budgetItemsWithContext: BudgetItemWithContext[] = projectBudgetItems.map((item) => ({
    id: item.id,
    name: item.name,
    unit: item.unit,
    category: item.category,
    total_price: item.total_price,
    previous_progress_pct: progressMap.get(item.id) ?? 0,
  }))

  // Next cut number
  const allCuts = await db
    .select({ cut_number: work_cuts.cut_number })
    .from(work_cuts)
    .where(eq(work_cuts.project_id, params.id))

  const nextCutNumber = (Math.max(0, ...allCuts.map((c) => c.cut_number))) + 1

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/proyectos/${params.id}/cortes`} className="text-muted-foreground hover:text-foreground p-1 -m-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold">Corte #{nextCutNumber}</h1>
          <p className="text-xs text-muted-foreground">{project.name}</p>
        </div>
      </div>

      <CorteForm
        projectId={project.id}
        cutNumber={nextCutNumber}
        advancePercentage={parseFloat(project.advance_percentage)}
        quotedAmount={parseFloat(project.quoted_amount)}
        budgetItems={budgetItemsWithContext}
        previouslyExecuted={previouslyExecuted}
      />
    </div>
  )
}
