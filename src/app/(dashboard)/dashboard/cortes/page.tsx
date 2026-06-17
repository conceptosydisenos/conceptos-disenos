import { db } from "@/lib/db"
import { work_cuts, projects, clients } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { Header } from "@/components/layout/Header"
import { eq, desc } from "drizzle-orm"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { formatCOP } from "@/lib/utils"
import { Scissors, ArrowRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

export const revalidate = 0

const STATUS_CONFIG = {
  draft: {
    label: "Borrador",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
  submitted: {
    label: "Enviado",
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
  approved: {
    label: "Aprobado",
    className: "bg-green-100 text-green-700 border-green-200",
  },
} as const

type CutStatus = keyof typeof STATUS_CONFIG

interface PageProps {
  searchParams: { status?: string }
}

export default async function CortesPage({ searchParams }: PageProps) {
  await requireAuth()
  const activeFilter = searchParams.status ?? "all"

  const rows = await db
    .select({
      id: work_cuts.id,
      cut_number: work_cuts.cut_number,
      cut_date: work_cuts.cut_date,
      status: work_cuts.status,
      progress_percentage: work_cuts.progress_percentage,
      total_executed: work_cuts.total_executed,
      amount_to_pay: work_cuts.amount_to_pay,
      project_id: projects.id,
      project_name: projects.name,
      client_name: clients.name,
      created_at: work_cuts.created_at,
    })
    .from(work_cuts)
    .innerJoin(projects, eq(work_cuts.project_id, projects.id))
    .leftJoin(clients, eq(projects.client_id, clients.id))
    .where(
      activeFilter !== "all"
        ? eq(work_cuts.status, activeFilter as CutStatus)
        : undefined
    )
    .orderBy(desc(work_cuts.created_at))
    .limit(100)

  const filters = [
    { key: "all", label: "Todos" },
    { key: "draft", label: "Borrador" },
    { key: "submitted", label: "Enviados" },
    { key: "approved", label: "Aprobados" },
  ]

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div>
      <Header title="Cortes de obra" subtitle="Vista global de todos los proyectos" />

      <div className="px-4 md:px-6 py-6 space-y-5">
        {/* Filters */}
        <div className="flex overflow-x-auto gap-1 pb-1 -mb-1 scrollbar-none">
          {filters.map((f) => {
            const count = f.key === "all" ? rows.length : (counts[f.key] ?? 0)
            return (
              <Link
                key={f.key}
                href={`/dashboard/cortes${f.key !== "all" ? `?status=${f.key}` : ""}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  activeFilter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {f.label}
                {count > 0 && (
                  <span className={`text-[10px] tabular-nums ${activeFilter === f.key ? "opacity-75" : "opacity-60"}`}>
                    {count}
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        {/* Hint: go to project to create a cut */}
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
          <Plus className="w-4 h-4 text-blue-500 shrink-0" />
          <p className="text-xs text-blue-700">
            Para crear un nuevo corte, abre el proyecto y ve a la sección{" "}
            <strong>Cortes de obra</strong>.
          </p>
        </div>

        {/* List */}
        {rows.length === 0 ? (
          <div className="section-card py-16 text-center">
            <Scissors className="w-10 h-10 text-muted-foreground/25 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Sin cortes registrados</p>
            <p className="text-xs text-muted-foreground mt-1">
              Los cortes se crean desde el detalle de cada proyecto.
            </p>
            <Button asChild size="sm" variant="outline" className="mt-4">
              <Link href="/dashboard/proyectos">Ver proyectos</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((cut) => {
              const cfg = STATUS_CONFIG[cut.status as CutStatus] ?? STATUS_CONFIG.draft
              const progress = parseFloat(cut.progress_percentage)
              return (
                <Link
                  key={cut.id}
                  href={`/dashboard/proyectos/${cut.project_id}/cortes/${cut.id}`}
                  className="section-card flex items-center gap-4 hover:shadow-md transition-shadow group"
                >
                  {/* Left: status indicator */}
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted shrink-0">
                    <Scissors className="w-4 h-4 text-muted-foreground" />
                  </div>

                  {/* Middle: project + cut info */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {cut.project_name} — Corte #{cut.cut_number}
                      </p>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${cfg.className}`}>
                        {cfg.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {cut.client_name && <span>{cut.client_name} · </span>}
                      {cut.cut_date} · Avance {progress.toFixed(1)}%
                    </p>
                  </div>

                  {/* Right: amounts */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold amount text-foreground">
                      {formatCOP(cut.amount_to_pay)}
                    </p>
                    <p className="text-xs text-muted-foreground">a pagar</p>
                  </div>

                  <ArrowRight className="w-4 h-4 text-muted-foreground/40 shrink-0 group-hover:text-primary transition-colors" />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
