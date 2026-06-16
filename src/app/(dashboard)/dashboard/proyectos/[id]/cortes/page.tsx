import { db } from "@/lib/db"
import { work_cuts, projects, clients } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Plus, FileText, CheckCircle2, Clock, Send } from "lucide-react"
import { calculateCumulativeProgress } from "@/lib/calculations"

export const revalidate = 0

interface Props {
  params: { id: string }
}

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
})

const STATUS_CONFIG = {
  draft: { label: "Borrador", Icon: Clock, badge: "outline" as const, color: "text-muted-foreground" },
  submitted: { label: "Enviado", Icon: Send, badge: "secondary" as const, color: "text-amber-600" },
  approved: { label: "Aprobado", Icon: CheckCircle2, badge: "default" as const, color: "text-green-600" },
}

export default async function CortesListPage({ params }: Props) {
  await requireAuth()

  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      quoted_amount: projects.quoted_amount,
      client_name: clients.name,
    })
    .from(projects)
    .leftJoin(clients, eq(projects.client_id, clients.id))
    .where(eq(projects.id, params.id))

  if (!project) notFound()

  const cuts = await db
    .select()
    .from(work_cuts)
    .where(eq(work_cuts.project_id, params.id))
    .orderBy(work_cuts.cut_number)

  const approvedCuts = cuts.filter((c) => c.status === "approved")
  const cumulativeProgress = calculateCumulativeProgress(
    approvedCuts.map((c) => c.total_executed),
    project.quoted_amount
  )
  const hasDraft = cuts.some((c) => c.status === "draft")

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/proyectos/${params.id}`} className="text-muted-foreground hover:text-foreground p-1 -m-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold">Cortes de obra</h1>
          <p className="text-xs text-muted-foreground truncate">{project.name}</p>
        </div>
        {!hasDraft && (
          <Button asChild size="sm" className="gap-1.5 shrink-0">
            <Link href={`/dashboard/proyectos/${params.id}/cortes/nuevo`}>
              <Plus className="w-4 h-4" />
              Nuevo
            </Link>
          </Button>
        )}
      </div>

      {/* Cumulative progress */}
      {approvedCuts.length > 0 && (
        <div className="section-card space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Avance acumulado aprobado</span>
            <span className="font-bold">{cumulativeProgress.toFixed(1)}%</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${cumulativeProgress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {approvedCuts.length} corte{approvedCuts.length !== 1 ? "s" : ""} aprobado{approvedCuts.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Draft warning */}
      {hasDraft && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-200 bg-amber-50">
          <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-px" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Hay un corte en borrador</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Completa o descarta el borrador antes de crear un nuevo corte.
            </p>
          </div>
        </div>
      )}

      {/* Cuts list */}
      {cuts.length === 0 ? (
        <div className="section-card flex flex-col items-center justify-center py-16 text-center">
          <FileText className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Sin cortes registrados</p>
          <p className="text-xs text-muted-foreground mt-1">
            Registra el primer corte de avance de obra
          </p>
          <Button asChild size="sm" className="mt-4 gap-2">
            <Link href={`/dashboard/proyectos/${params.id}/cortes/nuevo`}>
              <Plus className="w-4 h-4" />
              Registrar corte
            </Link>
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border bg-card overflow-hidden">
          {cuts.map((cut) => {
            const cfg = STATUS_CONFIG[cut.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.draft
            const Icon = cfg.Icon
            return (
              <Link
                key={cut.id}
                href={`/dashboard/proyectos/${params.id}/cortes/${cut.id}`}
                className="flex items-center gap-3 px-4 py-4 hover:bg-muted/30 active:bg-muted/50 transition-colors"
              >
                <div className={`shrink-0 ${cfg.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-sm font-semibold">Corte #{cut.cut_number}</p>
                  <p className="text-xs text-muted-foreground">{cut.cut_date}</p>
                </div>
                <div className="shrink-0 text-right space-y-1">
                  <p className="text-sm font-bold tabular-nums">
                    {COP.format(parseFloat(cut.total_executed))}
                  </p>
                  <Badge variant={cfg.badge} className="text-[10px] px-1.5 py-0">
                    {cfg.label}
                  </Badge>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
