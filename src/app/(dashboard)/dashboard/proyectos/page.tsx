import { db } from "@/lib/db"
import { projects, clients } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/auth"
import { Header } from "@/components/layout/Header"
import { and, eq, desc, sql } from "drizzle-orm"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { formatCOP } from "@/lib/utils"
import { Plus, FolderOpen, ArrowRight, Archive } from "lucide-react"

export const revalidate = 0

const STATUS_MAP = {
  active: { label: "Activo", className: "bg-green-100 text-green-700 border-green-200" },
  paused: { label: "En pausa", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  completed: { label: "Terminado", className: "bg-blue-100 text-blue-700 border-blue-200" },
  in_warranty: { label: "En garantía", className: "bg-purple-100 text-purple-700 border-purple-200" },
  cancelled: { label: "Cancelado", className: "bg-red-100 text-red-700 border-red-200" },
} as const

type ProjectStatus = keyof typeof STATUS_MAP

interface PageProps {
  searchParams: { status?: string; ver?: string }
}

export default async function ProyectosPage({ searchParams }: PageProps) {
  const user = await getCurrentUser()
  const isAdmin = user?.role === "admin"
  const activeFilter = (searchParams.status ?? "all") as string
  const showArchived = searchParams.ver === "archivados"

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      start_date: projects.start_date,
      estimated_end_date: projects.estimated_end_date,
      quoted_amount: projects.quoted_amount,
      client_name: clients.name,
    })
    .from(projects)
    .leftJoin(clients, eq(projects.client_id, clients.id))
    .where(
      and(
        eq(projects.archived, showArchived),
        activeFilter !== "all" ? eq(projects.status, activeFilter as ProjectStatus) : undefined,
      )
    )
    .orderBy(desc(projects.created_at))

  const counts = await db
    .select({
      status: projects.status,
      count: sql<number>`count(*)::int`,
    })
    .from(projects)
    .where(eq(projects.archived, false))
    .groupBy(projects.status)

  const countMap = Object.fromEntries(counts.map((r) => [r.status, r.count]))
  const total = counts.reduce((s, r) => s + r.count, 0)

  const filters = [
    { key: "all", label: "Todos", count: total },
    { key: "active", label: "Activos", count: countMap.active ?? 0 },
    { key: "paused", label: "En pausa", count: countMap.paused ?? 0 },
    { key: "completed", label: "Terminados", count: countMap.completed ?? 0 },
    { key: "in_warranty", label: "En garantía", count: countMap.in_warranty ?? 0 },
  ]

  return (
    <div>
      <Header title={showArchived ? "Proyectos archivados" : "Proyectos"} />

      <div className="px-4 md:px-6 py-6 space-y-5">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex overflow-x-auto gap-1 pb-1 -mb-1 scrollbar-none">
            {!showArchived && filters.map((f) => (
              <Link
                key={f.key}
                href={`/dashboard/proyectos${f.key !== "all" ? `?status=${f.key}` : ""}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  activeFilter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {f.label}
                {f.count > 0 && (
                  <span className={`text-[10px] tabular-nums ${activeFilter === f.key ? "opacity-75" : "opacity-60"}`}>
                    {f.count}
                  </span>
                )}
              </Link>
            ))}
          </div>
          {isAdmin && !showArchived && (
            <Button asChild size="sm" className="shrink-0">
              <Link href="/dashboard/proyectos/nuevo">
                <Plus className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Nuevo</span>
              </Link>
            </Button>
          )}
        </div>

        {/* Archive toggle */}
        <div>
          {showArchived ? (
            <Link
              href="/dashboard/proyectos"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Volver a proyectos activos
            </Link>
          ) : (
            <Link
              href="/dashboard/proyectos?ver=archivados"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Archive className="w-3.5 h-3.5" />
              Ver archivados
            </Link>
          )}
        </div>

        {/* List */}
        {rows.length === 0 ? (
          <div className="section-card py-12 text-center">
            <FolderOpen className="w-10 h-10 text-muted-foreground/25 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No hay proyectos</p>
            {isAdmin && (
              <Button asChild size="sm" className="mt-4">
                <Link href="/dashboard/proyectos/nuevo">
                  <Plus className="w-4 h-4 mr-1" />
                  Crear proyecto
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((p) => {
              const status = (STATUS_MAP[p.status as ProjectStatus] ?? STATUS_MAP.active)
              return (
                <Link
                  key={p.id}
                  href={`/dashboard/proyectos/${p.id}`}
                  className="section-card flex items-center gap-4 hover:shadow-md transition-shadow group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1">
                      <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {p.name}
                      </p>
                      <Badge
                        variant="outline"
                        className={`text-[10px] shrink-0 mt-px ${status.className}`}
                      >
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {p.client_name && <span className="truncate">{p.client_name}</span>}
                      <span className="shrink-0">Inicio {formatDate(p.start_date)}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold amount text-foreground">
                      {formatCOP(p.quoted_amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">cotizado</p>
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

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-")
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
  return `${day} ${months[parseInt(month) - 1]} ${year}`
}
