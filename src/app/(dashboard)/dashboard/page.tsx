import { eq, and, sql, lt } from "drizzle-orm"
import { db } from "@/lib/db"
import { invoices, projects, work_cuts } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/auth"
import { Header } from "@/components/layout/Header"
import {
  FolderOpen,
  Receipt,
  Scissors,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  FileUp,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { formatCOP } from "@/lib/utils"

export const revalidate = 300

async function getDashboardData(isAdmin: boolean) {
  const overdueThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000)

  const [
    activeProjectsResult,
    pendingInvoicesResult,
    pendingCutsResult,
    overdueInvoicesResult,
    recentProjects,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(projects)
      .where(eq(projects.status, "active")),

    db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(eq(invoices.status, "pending_allocation")),

    db
      .select({ count: sql<number>`count(*)::int` })
      .from(work_cuts)
      .where(eq(work_cuts.status, "submitted")),

    isAdmin
      ? db
          .select({ count: sql<number>`count(*)::int` })
          .from(invoices)
          .where(
            and(
              eq(invoices.status, "pending_allocation"),
              lt(invoices.created_at, overdueThreshold)
            )
          )
      : Promise.resolve([{ count: 0 }]),

    db
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
        quoted_amount: projects.quoted_amount,
      })
      .from(projects)
      .orderBy(sql`${projects.created_at} desc`)
      .limit(5),
  ])

  return {
    activeProjects: activeProjectsResult[0]?.count ?? 0,
    pendingInvoices: pendingInvoicesResult[0]?.count ?? 0,
    pendingCuts: pendingCutsResult[0]?.count ?? 0,
    overdueInvoices: overdueInvoicesResult[0]?.count ?? 0,
    recentProjects,
  }
}

export default async function DashboardPage() {
  const user = await getCurrentUser()
  const isAdmin = user?.role === "admin"
  const data = await getDashboardData(isAdmin ?? false)
  const firstName = user?.name.split(" ")[0] ?? "Usuario"

  const now = new Date()
  const hour = now.getHours()
  const greeting =
    hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches"

  return (
    <div>
      <Header title="Resumen" subtitle={`${greeting}, ${firstName}`} />

      <div className="px-4 md:px-6 py-6 space-y-6">
        {/* Overdue alert — admin only */}
        {isAdmin && data.overdueInvoices > 0 && (
          <Link
            href="/dashboard/facturas?filter=overdue"
            className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
          >
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-100 shrink-0">
              <AlertTriangle className="w-4.5 h-4.5 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-800">
                {data.overdueInvoices}{" "}
                {data.overdueInvoices === 1 ? "factura sin asignar" : "facturas sin asignar"}{" "}
                hace más de 48 horas
              </p>
              <p className="text-xs text-red-600">Requieren asignación a proyectos</p>
            </div>
            <ArrowRight className="w-4 h-4 text-red-400 shrink-0" />
          </Link>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Proyectos activos"
            value={data.activeProjects}
            icon={<FolderOpen className="w-4 h-4" />}
            href="/dashboard/proyectos"
            color="blue"
          />
          <KpiCard
            label="Facturas pendientes"
            value={data.pendingInvoices}
            icon={<Receipt className="w-4 h-4" />}
            href="/dashboard/facturas"
            color={data.pendingInvoices > 0 ? "amber" : "neutral"}
          />
          <KpiCard
            label="Cortes por aprobar"
            value={data.pendingCuts}
            icon={<Scissors className="w-4 h-4" />}
            href="/dashboard/cortes"
            color={data.pendingCuts > 0 ? "amber" : "neutral"}
          />
          <KpiCard
            label="Margen promedio"
            value="—"
            icon={<TrendingUp className="w-4 h-4" />}
            href="/dashboard/reportes"
            color="green"
            suffix="%"
          />
        </div>

        {/* Import CTA — admin only */}
        {isAdmin && (
          <Link
            href="/dashboard/importar"
            className="flex items-center gap-4 p-4 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-muted/20 transition-colors group"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors shrink-0">
              <FileUp className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                Importar datos históricos
              </p>
              <p className="text-xs text-muted-foreground">
                Carga tus Excel de Carolina convertidos a Markdown
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground/40 shrink-0 group-hover:text-primary transition-colors" />
          </Link>
        )}

        {/* Recent projects */}
        <div className="section-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Proyectos recientes</h2>
            <Link
              href="/dashboard/proyectos"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {data.recentProjects.length === 0 ? (
            <div className="py-8 text-center">
              <FolderOpen className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No hay proyectos aún</p>
              <Link
                href="/dashboard/proyectos/nuevo"
                className="mt-2 inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
              >
                Crear el primero
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {data.recentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/dashboard/proyectos/${project.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {project.name}
                    </p>
                    <p className="text-xs text-muted-foreground amount">
                      {formatCOP(project.quoted_amount)}
                    </p>
                  </div>
                  <StatusBadge status={project.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  icon,
  href,
  color,
  suffix,
}: {
  label: string
  value: number | string
  icon: React.ReactNode
  href: string
  color: "blue" | "amber" | "green" | "neutral"
  suffix?: string
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-emerald-50 text-emerald-700",
    green: "bg-green-50 text-green-600",
    neutral: "bg-muted text-muted-foreground",
  }

  return (
    <Link href={href} className="section-card hover:shadow-md transition-shadow block">
      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${colors[color]} mb-3`}>
        {icon}
      </div>
      <p className="kpi-value text-foreground">
        {value}
        {suffix && <span className="text-lg">{suffix}</span>}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </Link>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: "Activo", className: "bg-green-100 text-green-700 border-green-200" },
    paused: { label: "Pausado", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    completed: { label: "Completado", className: "bg-blue-100 text-blue-700 border-blue-200" },
    cancelled: { label: "Cancelado", className: "bg-red-100 text-red-700 border-red-200" },
  }
  const { label, className } = map[status] ?? { label: status, className: "" }
  return (
    <Badge variant="outline" className={`text-[10px] shrink-0 ${className}`}>
      {label}
    </Badge>
  )
}
