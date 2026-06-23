"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"

// ── Types ─────────────────────────────────────────────────────
interface PipelineStage {
  status: string
  label:  string
  count:  number
  total_value: number
}

interface PendingQuote {
  id:           string
  quote_number: string
  project_name: string
  total_amount: number
  client_name:  string
  days_waiting: number
}

interface Conversion {
  converted_count: number
  total_sent:      number
  rate:            number
}

interface ProjectedAdvance {
  month:         string  // "YYYY-MM"
  advance_total: number
}

interface SeguimientoData {
  pipeline:          PipelineStage[]
  pendingQuotes:     PendingQuote[]
  conversion:        Conversion
  projectedAdvances: ProjectedAdvance[]
}

// ── Helpers ───────────────────────────────────────────────────
function formatCOP(n: number): string {
  return "$ " + Math.round(n).toLocaleString("es-CO")
}

const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

function formatMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split("-")
  return `${MONTHS_ES[parseInt(month) - 1]} ${year}`
}

const STAGE_COLORS: Record<string, string> = {
  new:             "bg-slate-100 text-slate-700",
  contacted:       "bg-blue-50 text-blue-700",
  visit_scheduled: "bg-purple-50 text-purple-700",
  quoted:          "bg-amber-50 text-amber-700",
  won:             "bg-green-50 text-green-700",
  lost:            "bg-red-50 text-red-600",
}

// ── Component ─────────────────────────────────────────────────
export default function SeguimientoPage() {
  const [data, setData]       = useState<SeguimientoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/comercial/seguimiento")
      .then(r => r.json())
      .then((json: { success: boolean; data?: SeguimientoData; error?: string }) => {
        if (!json.success) throw new Error(json.error ?? "Error desconocido")
        setData(json.data ?? null)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="px-4 pt-6 pb-24 md:px-8 max-w-4xl mx-auto">
        <div className="h-8 w-64 bg-muted animate-pulse rounded mb-6" />
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="px-4 pt-6 pb-24 md:px-8 max-w-4xl mx-auto">
        <p className="text-destructive text-sm">{error ?? "Sin datos"}</p>
      </div>
    )
  }

  const { pipeline, pendingQuotes, conversion, projectedAdvances } = data

  return (
    <main className="px-4 pt-6 pb-24 md:px-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Seguimiento comercial</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Resumen del pipeline y cotizaciones activas</p>
      </div>

      {/* 1. Pipeline */}
      <section aria-labelledby="pipeline-heading">
        <h2 id="pipeline-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Pipeline de leads
        </h2>

        {pipeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay leads activos en el pipeline.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-3 md:overflow-visible">
            {pipeline.map(stage => (
              <div
                key={stage.status}
                className={`flex-shrink-0 w-44 md:w-auto rounded-xl border border-border p-4 ${STAGE_COLORS[stage.status] ?? "bg-card"}`}
              >
                <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{stage.label}</p>
                <p className="text-3xl font-bold tabular-nums mt-1">{stage.count}</p>
                {stage.total_value > 0 && (
                  <p className="text-xs tabular-nums mt-1 opacity-70">{formatCOP(stage.total_value)}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2. Cotizaciones sin respuesta */}
      <section aria-labelledby="pending-heading">
        <h2 id="pending-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Cotizaciones sin respuesta &gt; 7 días
        </h2>

        {pendingQuotes.length === 0 ? (
          <Card className="section-card">
            <CardContent className="pt-6 text-center">
              <p className="text-2xl mb-1">🎉</p>
              <p className="text-sm font-medium text-foreground">Todo al día</p>
              <p className="text-xs text-muted-foreground mt-1">No hay cotizaciones esperando respuesta por más de 7 días.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingQuotes.map(q => (
              <div key={q.id} className="section-card flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-muted-foreground">{q.quote_number}</span>
                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                      {q.days_waiting}d sin respuesta
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground mt-0.5 truncate">{q.project_name}</p>
                  <p className="text-xs text-muted-foreground">{q.client_name}</p>
                  <p className="text-sm font-bold tabular-nums mt-1 text-foreground">{formatCOP(q.total_amount)}</p>
                </div>
                <Button asChild size="sm" variant="outline" className="shrink-0 gap-1.5">
                  <Link href={`/dashboard/cotizaciones/${q.id}`}>
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Ver</span>
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3 & 4: Conversion + Anticipos in 2-col on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* 3. Tasa de conversión */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Tasa de conversión
            </CardTitle>
          </CardHeader>
          <CardContent>
            {conversion.total_sent === 0 ? (
              <p className="text-sm text-muted-foreground">Sin cotizaciones enviadas aún.</p>
            ) : (
              <>
                <p className="text-5xl font-bold tabular-nums text-foreground">{conversion.rate}%</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {conversion.converted_count} de {conversion.total_sent} cotizaciones convertidas
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* 4. Anticipos proyectados */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Anticipos proyectados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {projectedAdvances.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin cotizaciones activas en los próximos 3 meses.</p>
            ) : (
              <div className="space-y-3">
                {projectedAdvances.map(adv => (
                  <div key={adv.month} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{formatMonth(adv.month)}</span>
                    <span className="text-sm font-bold tabular-nums text-foreground">{formatCOP(adv.advance_total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
