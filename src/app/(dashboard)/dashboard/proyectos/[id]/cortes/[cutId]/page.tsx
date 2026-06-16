import { db } from "@/lib/db"
import { work_cuts, work_cut_items, budget_items, projects, users } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Send,
  Lock,
  AlertTriangle,
} from "lucide-react"
import { CorteSummary } from "@/components/cortes/CorteSummary"
import { CorteStatusActions } from "@/components/cortes/CorteStatusActions"

export const revalidate = 0

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
})

const STATUS_CONFIG = {
  draft: { label: "Borrador", Icon: Clock, color: "text-muted-foreground", bg: "bg-muted/30 border-border" },
  submitted: { label: "Enviado al cliente", Icon: Send, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  approved: { label: "Aprobado", Icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 border-green-200" },
}

const CATEGORY_LABELS: Record<string, string> = {
  materiales: "Materiales",
  mano_obra: "Mano de obra",
  equipos: "Equipos",
  imprevistos: "Imprevistos",
  otro: "Otro",
}

interface Props {
  params: { id: string; cutId: string }
}

export default async function CorteDetailPage({ params }: Props) {
  const currentUser = await requireAuth()

  const [cut] = await db
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
      approved_at: work_cuts.approved_at,
      project_id: work_cuts.project_id,
    })
    .from(work_cuts)
    .where(eq(work_cuts.id, params.cutId))

  if (!cut || cut.project_id !== params.id) notFound()

  const [project] = await db
    .select({ name: projects.name, advance_percentage: projects.advance_percentage, quoted_amount: projects.quoted_amount })
    .from(projects)
    .where(eq(projects.id, params.id))

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
    .where(eq(work_cut_items.work_cut_id, params.cutId))

  const cfg = STATUS_CONFIG[cut.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.draft
  const Icon = cfg.Icon
  const isApproved = cut.status === "approved"
  const isAdmin = currentUser.role === "admin"

  // Group items by category
  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    const cat = item.item_category ?? "otro"
    return { ...acc, [cat]: [...(acc[cat] ?? []), item] }
  }, {})

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/proyectos/${params.id}/cortes`} className="text-muted-foreground hover:text-foreground p-1 -m-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold">Corte #{cut.cut_number}</h1>
          <p className="text-xs text-muted-foreground truncate">{project?.name} · {cut.cut_date}</p>
        </div>
      </div>

      {/* Status banner */}
      <div className={`flex items-center gap-2.5 p-3 rounded-xl border ${cfg.bg}`}>
        <Icon className={`w-4 h-4 ${cfg.color} shrink-0`} />
        <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
        {isApproved && (
          <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Inmutable
          </span>
        )}
        {isApproved && cut.approved_at && (
          <span className="text-xs text-muted-foreground">
            {new Date(cut.approved_at).toLocaleDateString("es-CO")}
          </span>
        )}
      </div>

      {/* Immutability notice */}
      {isApproved && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border text-sm">
          <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0 mt-px" />
          <p className="text-muted-foreground text-xs">
            Este corte está aprobado y no puede modificarse. Si hay ajustes, regístralos en el siguiente corte.
          </p>
        </div>
      )}

      {/* Financial summary */}
      <CorteSummary
        totalExecuted={parseFloat(cut.total_executed)}
        advancePercentage={parseFloat(project?.advance_percentage ?? "50")}
        quotedAmount={parseFloat(project?.quoted_amount ?? "0")}
        cumulativeProgress={parseFloat(cut.progress_percentage)}
      />

      {/* Activity breakdown */}
      {items.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Actividades
          </h2>
          {Object.entries(grouped).map(([category, catItems]) => (
            <div key={category} className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground px-1">
                {CATEGORY_LABELS[category] ?? category}
              </p>
              <div className="rounded-xl border bg-card overflow-hidden divide-y divide-border">
                {catItems.map((item) => {
                  const pct = parseFloat(item.progress_percentage)
                  const executed = parseFloat(item.executed_amount)
                  const total = parseFloat(item.item_total_price ?? "0")
                  return (
                    <div key={item.id} className="px-4 py-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.item_name}</p>
                          <p className="text-xs text-muted-foreground">{item.item_unit}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold tabular-nums">{COP.format(executed)}</p>
                          <p className="text-xs text-muted-foreground">{pct.toFixed(1)}%</p>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      {cut.notes && (
        <div className="section-card">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notas</p>
          <p className="text-sm text-muted-foreground">{cut.notes}</p>
        </div>
      )}

      {/* Status transition actions */}
      {!isApproved && (
        <CorteStatusActions
          cutId={cut.id}
          projectId={params.id}
          currentStatus={cut.status}
          isAdmin={isAdmin}
        />
      )}
    </div>
  )
}
