import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { getAlerts, type SystemAlert, type AlertSeverity } from "@/lib/alertas"
import { Header } from "@/components/layout/Header"
import Link from "next/link"
import { ArrowRight, BellRing, CheckCircle2 } from "lucide-react"

const SEVERITY_CONFIG: Record<AlertSeverity, { label: string; dot: string; card: string; badge: string }> = {
  critica: {
    label: "Crítica",
    dot:   "bg-red-500",
    card:  "border-red-200 bg-red-50",
    badge: "bg-red-100 text-red-700",
  },
  alta: {
    label: "Alta",
    dot:   "bg-orange-500",
    card:  "border-orange-200 bg-orange-50",
    badge: "bg-orange-100 text-orange-700",
  },
  media: {
    label: "Media",
    dot:   "bg-amber-500",
    card:  "border-amber-200 bg-amber-50",
    badge: "bg-amber-100 text-amber-700",
  },
  baja: {
    label: "Baja",
    dot:   "bg-blue-500",
    card:  "border-blue-200 bg-blue-50",
    badge: "bg-blue-100 text-blue-700",
  },
}

export default async function AlertasPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== "admin") redirect("/dashboard")

  const alerts = await getAlerts()

  const criticalCount = alerts.filter(a => a.severity === "critica" || a.severity === "alta").length

  return (
    <div>
      <Header
        title="Alertas del sistema"
        subtitle={
          alerts.length === 0
            ? "Sin alertas activas"
            : `${alerts.length} alerta${alerts.length !== 1 ? "s" : ""} activa${alerts.length !== 1 ? "s" : ""}`
        }
      />

      <div className="px-4 md:px-6 py-6 space-y-4 max-w-2xl">
        {/* Summary chips */}
        {alerts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {(["critica", "alta", "media", "baja"] as AlertSeverity[]).map((sev) => {
              const count = alerts.filter(a => a.severity === sev).length
              if (count === 0) return null
              const cfg = SEVERITY_CONFIG[sev]
              return (
                <span key={sev} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  {count} {cfg.label}{count !== 1 ? "s" : ""}
                </span>
              )
            })}
          </div>
        )}

        {/* Empty state */}
        {alerts.length === 0 && (
          <div className="section-card flex flex-col items-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-base font-semibold text-foreground">Todo en orden</p>
            <p className="text-sm text-muted-foreground mt-1">No hay alertas activas en este momento.</p>
          </div>
        )}

        {/* Alert list */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alert, idx) => (
              <AlertCard key={idx} alert={alert} />
            ))}
          </div>
        )}

        {criticalCount > 0 && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            {criticalCount} alerta{criticalCount !== 1 ? "s" : ""} requieren atención inmediata
          </p>
        )}
      </div>
    </div>
  )
}

function AlertCard({ alert }: { alert: SystemAlert }) {
  const cfg = SEVERITY_CONFIG[alert.severity]

  return (
    <div className={`rounded-xl border p-4 ${cfg.card}`}>
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${cfg.badge}`}>
            {cfg.label}
          </span>
        </div>
      </div>

      <p className="text-sm text-foreground mt-2 leading-snug">{alert.message}</p>

      {alert.project_id && (
        <Link
          href={`/dashboard/proyectos/${alert.project_id}`}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-foreground/70 hover:text-foreground transition-colors"
        >
          Ver proyecto <ArrowRight className="w-3 h-3" />
        </Link>
      )}
      {alert.quote_id && (
        <Link
          href={`/dashboard/cotizaciones/${alert.quote_id}`}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-foreground/70 hover:text-foreground transition-colors"
        >
          Ver cotización <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  )
}
