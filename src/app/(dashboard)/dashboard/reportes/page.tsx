"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { Download, X } from "lucide-react"
import { formatCOP } from "@/lib/utils"
import { cn } from "@/lib/utils"
import type { ReportData, ProjectReport, CashFlowMonth } from "@/app/api/reportes/route"

// ── Helpers ────────────────────────────────────────────────────

function monthLabel(ym: string): string {
  const [year, month] = ym.split("-")
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("es-CO", {
    month: "short",
    year: "numeric",
  })
}

function barWidth(value: number, max: number): string {
  if (max <= 0) return "0%"
  return `${Math.min((value / max) * 100, 100)}%`
}

// ── Sub-components ──────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
      {children}
    </p>
  )
}

function KpiCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: "green" | "red" | "amber"
}) {
  return (
    <div className="section-card flex flex-col gap-0.5">
      <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
      <p
        className={cn(
          "text-base font-bold tabular-nums leading-tight",
          highlight === "green"
            ? "text-green-700"
            : highlight === "red"
            ? "text-red-600"
            : highlight === "amber"
            ? "text-amber-700"
            : "text-foreground"
        )}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

function SemaphoreDot({ color }: { color: "green" | "amber" | "red" }) {
  return (
    <span
      className={cn(
        "inline-block w-2.5 h-2.5 rounded-full shrink-0",
        color === "green"
          ? "bg-green-500"
          : color === "amber"
          ? "bg-amber-400"
          : "bg-red-500"
      )}
    />
  )
}

function BarRow({
  label,
  value,
  max,
  color,
}: {
  label: string
  value: number
  max: number
  color: string
}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-xs text-muted-foreground w-24 shrink-0 truncate">{label}</span>
      <div className="flex-1 bg-muted rounded-full h-1.5 min-w-0">
        <div
          className={cn("h-1.5 rounded-full transition-all", color)}
          style={{ width: barWidth(value, max) }}
        />
      </div>
      <span className="text-xs tabular-nums shrink-0 w-28 text-right">{formatCOP(value)}</span>
    </div>
  )
}

// ── Report sections ─────────────────────────────────────────────

function ExecutiveReport({ d }: { d: ReportData["executive"] }) {
  const conversionLabel =
    d.wonQuotes + d.lostQuotes === 0
      ? "Sin datos"
      : `${d.wonQuotes}G / ${d.lostQuotes}P`

  return (
    <div>
      <SectionTitle>Resumen ejecutivo</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard label="Valor total contratado" value={formatCOP(d.totalContracted)} />
        <KpiCard label="Total anticipos cobrados" value={formatCOP(d.totalAdvances)} />
        <KpiCard
          label="Total gastado"
          value={formatCOP(d.totalSpent)}
          highlight="red"
        />
        <KpiCard
          label="Utilidad proyectada"
          value={formatCOP(d.projectedProfit)}
          highlight={d.projectedProfit >= 0 ? "green" : "red"}
        />
        <KpiCard
          label="Proyectos activos / cerrados"
          value={`${d.activeProjects} / ${d.closedProjects}`}
        />
        <KpiCard
          label="Tasa de conversión"
          value={`${d.conversionRate.toFixed(0)}%`}
          sub={conversionLabel}
          highlight={d.conversionRate >= 50 ? "green" : d.conversionRate > 0 ? "amber" : undefined}
        />
      </div>
    </div>
  )
}

function ProjectsReport({ projects }: { projects: ProjectReport[] }) {
  if (projects.length === 0) {
    return (
      <div>
        <SectionTitle>Estado por proyecto</SectionTitle>
        <div className="section-card text-sm text-muted-foreground text-center py-8">
          Sin proyectos registrados
        </div>
      </div>
    )
  }

  const STATUS_LABEL: Record<string, string> = {
    active:      "Activo",
    paused:      "Pausado",
    completed:   "Completado",
    in_warranty: "Garantía",
    cancelled:   "Cancelado",
  }

  return (
    <div>
      <SectionTitle>Estado por proyecto</SectionTitle>
      <div className="section-card divide-y divide-border space-y-0 p-0">
        {projects.map((p) => (
          <div key={p.id} className="px-4 md:px-6 py-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <SemaphoreDot color={p.semaphore} />
              <p className="text-sm font-medium text-foreground flex-1 min-w-0 truncate">
                {p.name}
              </p>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {STATUS_LABEL[p.status] ?? p.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground pl-4">{p.clientName}</p>
            <div className="pl-4 flex flex-wrap gap-x-4 gap-y-0.5 text-xs tabular-nums">
              <span className="text-muted-foreground">
                Contrato:{" "}
                <span className="text-foreground font-medium">{formatCOP(p.quotedAmount)}</span>
              </span>
              <span className="text-muted-foreground">
                Gastado:{" "}
                <span className="text-foreground font-medium">{formatCOP(p.totalSpent)}</span>
              </span>
              <span
                className={cn(
                  "font-semibold",
                  p.semaphore === "green"
                    ? "text-green-700"
                    : p.semaphore === "amber"
                    ? "text-amber-700"
                    : "text-red-600"
                )}
              >
                Margen: {p.marginPct.toFixed(1)}%
              </span>
            </div>
            {/* Margin bar */}
            <div className="pl-4 pr-0">
              <div className="bg-muted rounded-full h-1">
                <div
                  className={cn(
                    "h-1 rounded-full",
                    p.semaphore === "green"
                      ? "bg-green-500"
                      : p.semaphore === "amber"
                      ? "bg-amber-400"
                      : "bg-red-500"
                  )}
                  style={{ width: barWidth(Math.max(p.marginPct, 0), 50) }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CashFlowReport({ cashFlow }: { cashFlow: CashFlowMonth[] }) {
  const maxVal = Math.max(
    ...cashFlow.flatMap((m) => [m.advances, m.invoices, m.contractors]),
    1
  )

  return (
    <div>
      <SectionTitle>Flujo de caja — últimos 6 meses</SectionTitle>
      <div className="space-y-3">
        {cashFlow.map((m) => (
          <div key={m.month} className="section-card">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-foreground capitalize">
                {monthLabel(m.month)}
              </p>
              <p
                className={cn(
                  "text-xs font-bold tabular-nums",
                  m.net >= 0 ? "text-green-700" : "text-red-600"
                )}
              >
                Neto: {m.net >= 0 ? "+" : ""}
                {formatCOP(m.net)}
              </p>
            </div>
            <div className="space-y-1.5">
              <BarRow label="Anticipos" value={m.advances} max={maxVal} color="bg-green-500" />
              <BarRow label="Facturas"  value={m.invoices} max={maxVal} color="bg-red-400" />
              <BarRow label="Contratistas" value={m.contractors} max={maxVal} color="bg-orange-400" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PipelineReport({ pipeline }: { pipeline: ReportData["pipeline"] }) {
  const statuses = [
    { key: "draft",     label: "Borrador",   data: pipeline.draft,     color: "bg-muted-foreground/40" },
    { key: "sent",      label: "Enviada",    data: pipeline.sent,      color: "bg-blue-400" },
    { key: "approved",  label: "Aprobada",   data: pipeline.approved,  color: "bg-green-500" },
    { key: "rejected",  label: "Rechazada",  data: pipeline.rejected,  color: "bg-red-400" },
    { key: "converted", label: "Convertida", data: pipeline.converted, color: "bg-emerald-600" },
  ] as const

  const maxVal = Math.max(...statuses.map((s) => s.data.value), 1)
  const totalQuotes = statuses.reduce((s, r) => s + r.data.count, 0)

  return (
    <div>
      <SectionTitle>Cotizaciones y pipeline</SectionTitle>
      <div className="section-card space-y-1">
        {statuses.map(({ key, label, data, color }) => (
          <div key={key} className="flex items-center gap-2 py-1">
            <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
            <div className="flex-1 bg-muted rounded-full h-2 min-w-0">
              <div
                className={cn("h-2 rounded-full", color)}
                style={{ width: barWidth(data.value, maxVal) }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground shrink-0 w-6 text-center">
              {data.count}
            </span>
            <span className="text-xs tabular-nums shrink-0 w-28 text-right">
              {formatCOP(data.value)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard
          label="En pipeline"
          value={formatCOP(pipeline.pipelineValue)}
          sub="Enviadas + aprobadas"
          highlight="green"
        />
        <KpiCard
          label="Tasa de conversión"
          value={`${pipeline.conversionRate.toFixed(0)}%`}
          sub="Ganadas / (gan. + perd.)"
        />
        <KpiCard label="Total cotizaciones" value={`${totalQuotes}`} />
      </div>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────

export default function ReportesPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showExportMsg, setShowExportMsg] = useState(false)

  useEffect(() => {
    fetch("/api/reportes")
      .then((r) => r.json())
      .then((json: { success: boolean; data?: ReportData; error?: string }) => {
        if (json.success && json.data) {
          setData(json.data)
        } else {
          setError(json.error ?? "Error al cargar los reportes")
        }
      })
      .catch(() => setError("Error de conexión"))
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <Header
        title="Reportes"
        subtitle="Visión gerencial del negocio"
      />

      {/* Toolbar */}
      <div className="px-4 md:px-6 pt-4 flex justify-end max-w-4xl">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setShowExportMsg(true)}
        >
          <Download className="w-3.5 h-3.5" />
          Exportar
        </Button>
      </div>

      {showExportMsg && (
        <div className="mx-4 md:mx-6 mt-3 max-w-4xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-center justify-between gap-3">
          <p className="text-xs text-amber-800">
            Próximamente: exportación a PDF disponible en la siguiente actualización.
          </p>
          <button
            onClick={() => setShowExportMsg(false)}
            className="text-amber-500 hover:text-amber-700 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="px-4 md:px-6 py-6 space-y-8 max-w-4xl">
        {loading && (
          <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
            Cargando reportes…
          </div>
        )}

        {error && (
          <div className="section-card text-sm text-red-600 text-center py-8">
            {error}
          </div>
        )}

        {data && (
          <>
            <ExecutiveReport d={data.executive} />
            <ProjectsReport projects={data.projects} />
            <CashFlowReport cashFlow={data.cashFlow} />
            <PipelineReport pipeline={data.pipeline} />
          </>
        )}
      </div>
    </>
  )
}
