import { db } from "@/lib/db"
import {
  projects,
  invoice_allocations,
  invoices,
  contractor_payments,
  advances,
  work_cuts,
  clients,
} from "@/lib/db/schema"
import { requireRole } from "@/lib/auth"
import { and, eq, sql, sum, inArray } from "drizzle-orm"
import {
  calculateProjectMargin,
  calculateAdvanceBalance,
  calculateCumulativeProgress,
  getMarginStatus,
} from "@/lib/calculations"
import Link from "next/link"
import { TrendingUp, TrendingDown, Minus, ArrowRight, Calendar } from "lucide-react"
import { ProfitabilityBarChart } from "@/components/rentabilidad/ProfitabilityBarChart"
import { CostEvolutionChart } from "@/components/rentabilidad/CostEvolutionChart"
import type { ProjectBarData } from "@/components/rentabilidad/ProfitabilityBarChart"
import type { MonthCostData } from "@/components/rentabilidad/CostEvolutionChart"

export const revalidate = 0

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
})

const MONTH_LABELS: Record<string, string> = {
  "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic",
}

function getLast6Months(): string[] {
  const months: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    )
  }
  return months
}

function shortName(name: string): string {
  if (name.length <= 14) return name
  return name.split(" ").slice(0, 2).join(" ").slice(0, 14)
}

function MarginIcon({ marginPct }: { marginPct: number }) {
  if (marginPct > 15) return <TrendingUp className="w-4 h-4 text-green-600" />
  if (marginPct >= 5) return <Minus className="w-4 h-4 text-amber-500" />
  return <TrendingDown className="w-4 h-4 text-red-500" />
}

const SEMAPHORE = {
  green: {
    border: "border-l-green-500",
    badge: "bg-green-100 text-green-700",
    label: "Saludable",
  },
  amber: {
    border: "border-l-amber-400",
    badge: "bg-amber-100 text-amber-700",
    label: "Alerta",
  },
  red: {
    border: "border-l-red-500",
    badge: "bg-red-100 text-red-700",
    label: "Crítico",
  },
}

export default async function RentabilidadPage() {
  await requireRole(["admin", "accountant"])

  // ── 1. Active + paused projects ──────────────────────────────
  const activeProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      quoted_amount: projects.quoted_amount,
      advance_percentage: projects.advance_percentage,
      client_name: clients.name,
    })
    .from(projects)
    .leftJoin(clients, eq(projects.client_id, clients.id))
    .where(inArray(projects.status, ["active", "paused"]))
    .orderBy(projects.name)

  const projectIds = activeProjects.map((p) => p.id)

  if (projectIds.length === 0) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-12 text-center text-muted-foreground">
        <p className="text-sm">Sin proyectos activos para analizar.</p>
        <Link href="/dashboard/proyectos/nuevo" className="mt-3 inline-block text-sm text-primary font-medium">
          Crear proyecto
        </Link>
      </main>
    )
  }

  // ── 2. Batch aggregates (one query per metric) ────────────────
  const [
    allInvoiceCosts,
    allContractorCosts,
    allAdvances,
    allAmortizations,
    allExecuted,
  ] = await Promise.all([
    db
      .select({ project_id: invoice_allocations.project_id, total: sum(invoice_allocations.amount) })
      .from(invoice_allocations)
      .where(inArray(invoice_allocations.project_id, projectIds))
      .groupBy(invoice_allocations.project_id),

    db
      .select({ project_id: contractor_payments.project_id, total: sum(contractor_payments.amount) })
      .from(contractor_payments)
      .where(
        and(
          inArray(contractor_payments.project_id, projectIds),
          eq(contractor_payments.status, "paid")
        )
      )
      .groupBy(contractor_payments.project_id),

    db
      .select({ project_id: advances.project_id, total: sum(advances.amount) })
      .from(advances)
      .where(inArray(advances.project_id, projectIds))
      .groupBy(advances.project_id),

    db
      .select({ project_id: work_cuts.project_id, total: sum(work_cuts.advance_amortization) })
      .from(work_cuts)
      .where(
        and(
          inArray(work_cuts.project_id, projectIds),
          eq(work_cuts.status, "approved")
        )
      )
      .groupBy(work_cuts.project_id),

    db
      .select({ project_id: work_cuts.project_id, total: sum(work_cuts.total_executed) })
      .from(work_cuts)
      .where(
        and(
          inArray(work_cuts.project_id, projectIds),
          eq(work_cuts.status, "approved")
        )
      )
      .groupBy(work_cuts.project_id),
  ])

  // Build lookup maps
  const invMap = Object.fromEntries(allInvoiceCosts.map((r) => [r.project_id, parseFloat(r.total ?? "0")]))
  const contMap = Object.fromEntries(allContractorCosts.map((r) => [r.project_id, parseFloat(r.total ?? "0")]))
  const advMap = Object.fromEntries(allAdvances.map((r) => [r.project_id, parseFloat(r.total ?? "0")]))
  const amortMap = Object.fromEntries(allAmortizations.map((r) => [r.project_id, parseFloat(r.total ?? "0")]))
  const execMap = Object.fromEntries(allExecuted.map((r) => [r.project_id, parseFloat(r.total ?? "0")]))

  // ── 3. Compute per-project metrics ──────────────────────────
  const projectData = activeProjects.map((p) => {
    const invCost = invMap[p.id] ?? 0
    const contCost = contMap[p.id] ?? 0
    const totalCost = invCost + contCost
    const quoted = parseFloat(p.quoted_amount)
    const { amount: marginAmt, percentage: marginPct } = calculateProjectMargin(quoted, totalCost)
    const advRec = advMap[p.id] ?? 0
    const advAmort = amortMap[p.id] ?? 0
    const executed = execMap[p.id] ?? 0
    return {
      id: p.id,
      name: p.name,
      clientName: p.client_name ?? "",
      status: p.status,
      quoted,
      totalCost,
      invoiceCost: invCost,
      contractorCost: contCost,
      margin: marginAmt,
      marginPct,
      marginStatus: getMarginStatus(marginPct),
      advanceReceived: advRec,
      advanceAmortized: advAmort,
      advanceBalance: calculateAdvanceBalance(advRec, advAmort),
      cutProgress: calculateCumulativeProgress([executed], quoted),
    }
  })

  // Sort by margin % ascending (worst first)
  const sorted = [...projectData].sort((a, b) => a.marginPct - b.marginPct)

  // ── 4. Monthly totals (current month) ────────────────────────
  const [monthlyInvoiced, monthlyContractorPaid] = await Promise.all([
    db
      .select({ total: sum(invoice_allocations.amount) })
      .from(invoice_allocations)
      .leftJoin(invoices, eq(invoice_allocations.invoice_id, invoices.id))
      .where(
        sql`DATE_TRUNC('month', ${invoices.created_at}) = DATE_TRUNC('month', NOW())`
      ),

    db
      .select({ total: sum(contractor_payments.amount) })
      .from(contractor_payments)
      .where(
        and(
          eq(contractor_payments.status, "paid"),
          sql`DATE_TRUNC('month', ${contractor_payments.payment_date}::timestamptz) = DATE_TRUNC('month', NOW())`
        )
      ),
  ])

  const monthlyInvAmt = parseFloat(monthlyInvoiced[0]?.total ?? "0")
  const monthlyContAmt = parseFloat(monthlyContractorPaid[0]?.total ?? "0")

  // Flujo de caja: total advance balance across all projects (money collected, pending amortization)
  const totalAdvanceBalance = projectData.reduce((s, p) => s + p.advanceBalance, 0)

  // ── 5. 6-month cost evolution ────────────────────────────────
  const [monthlyInvHistory, monthlyContHistory] = await Promise.all([
    db
      .select({
        month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${invoices.created_at}), 'YYYY-MM')`,
        total: sql<string>`COALESCE(SUM(${invoice_allocations.amount}), 0)`,
      })
      .from(invoice_allocations)
      .leftJoin(invoices, eq(invoice_allocations.invoice_id, invoices.id))
      .where(sql`${invoices.created_at} >= NOW() - INTERVAL '6 months'`)
      .groupBy(sql`DATE_TRUNC('month', ${invoices.created_at})`)
      .orderBy(sql`DATE_TRUNC('month', ${invoices.created_at})`),

    db
      .select({
        month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${contractor_payments.payment_date}::timestamptz), 'YYYY-MM')`,
        total: sql<string>`COALESCE(SUM(${contractor_payments.amount}), 0)`,
      })
      .from(contractor_payments)
      .where(
        and(
          eq(contractor_payments.status, "paid"),
          sql`${contractor_payments.payment_date}::timestamptz >= NOW() - INTERVAL '6 months'`
        )
      )
      .groupBy(sql`DATE_TRUNC('month', ${contractor_payments.payment_date}::timestamptz)`)
      .orderBy(sql`DATE_TRUNC('month', ${contractor_payments.payment_date}::timestamptz)`),
  ])

  const invHistMap = Object.fromEntries(monthlyInvHistory.map((r) => [r.month, parseFloat(r.total)]))
  const contHistMap = Object.fromEntries(monthlyContHistory.map((r) => [r.month, parseFloat(r.total)]))

  const last6 = getLast6Months()
  const chartEvolution: MonthCostData[] = last6.map((m) => {
    const [, mm] = m.split("-")
    const facturas = invHistMap[m] ?? 0
    const contratistas = contHistMap[m] ?? 0
    return { month: m, label: MONTH_LABELS[mm] ?? m, facturas, contratistas, total: facturas + contratistas }
  })

  // Bar chart data
  const chartBar: ProjectBarData[] = projectData.map((p) => ({
    name: p.name,
    shortName: shortName(p.name),
    marginPct: parseFloat(p.marginPct.toFixed(1)),
    marginStatus: p.marginStatus,
  }))

  // Summary counts
  const counts = { green: 0, amber: 0, red: 0 }
  sorted.forEach((p) => counts[p.marginStatus]++)

  const now = new Date()
  const mesActual = `${MONTH_LABELS[String(now.getMonth() + 1).padStart(2, "0")]} ${now.getFullYear()}`

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Rentabilidad</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> {mesActual} · {activeProjects.length} proyectos activos
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
          {counts.green}
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block ml-1" />
          {counts.amber}
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block ml-1" />
          {counts.red}
        </div>
      </div>

      {/* Monthly KPI strip */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border bg-card p-3 space-y-0.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Facturado mes</p>
          <p className="text-sm font-bold tabular-nums">{COP.format(monthlyInvAmt)}</p>
        </div>
        <div className="rounded-xl border bg-card p-3 space-y-0.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pago contratistas</p>
          <p className="text-sm font-bold tabular-nums">{COP.format(monthlyContAmt)}</p>
        </div>
        <div className={`rounded-xl border p-3 space-y-0.5 ${totalAdvanceBalance > 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          <p className={`text-[10px] uppercase tracking-wide ${totalAdvanceBalance > 0 ? "text-green-700" : "text-red-600"}`}>Saldo anticipos</p>
          <p className={`text-sm font-bold tabular-nums ${totalAdvanceBalance > 0 ? "text-green-700" : "text-red-600"}`}>
            {COP.format(totalAdvanceBalance)}
          </p>
        </div>
      </div>

      {/* Project semaphore cards */}
      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold">Proyectos — semáforo</h2>
        {sorted.map((p) => {
          const sem = SEMAPHORE[p.marginStatus]
          return (
            <Link
              key={p.id}
              href={`/dashboard/proyectos/${p.id}`}
              className={`block rounded-2xl border-l-4 border border-border bg-card p-4 hover:bg-muted/30 transition-colors ${sem.border}`}
            >
              {/* Project name + badge */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.clientName}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <MarginIcon marginPct={p.marginPct} />
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sem.badge}`}>
                    {p.marginPct.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Financial grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Cotizado</p>
                  <p className="font-semibold tabular-nums">{COP.format(p.quoted)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Costo real</p>
                  <p className="font-semibold tabular-nums">{COP.format(p.totalCost)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Margen disponible</p>
                  <p className={`font-semibold tabular-nums ${p.margin >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {COP.format(p.margin)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Saldo anticipo</p>
                  <p className="font-semibold tabular-nums">{COP.format(p.advanceBalance)}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Avance acumulado</span>
                  <span className="font-semibold">{p.cutProgress.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(p.cutProgress, 100)}%` }}
                  />
                </div>
              </div>

              {/* Cost breakdown — materials vs contractors */}
              {p.totalCost > 0 && (
                <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <div
                    className="h-1 rounded-full bg-blue-400"
                    style={{ width: `${(p.invoiceCost / (p.invoiceCost + p.contractorCost || 1)) * 80}px` }}
                  />
                  <span>Mat. {COP.format(p.invoiceCost)}</span>
                  <span className="mx-1">·</span>
                  <div
                    className="h-1 rounded-full bg-purple-400"
                    style={{ width: `${(p.contractorCost / (p.invoiceCost + p.contractorCost || 1)) * 80}px` }}
                  />
                  <span>Contr. {COP.format(p.contractorCost)}</span>
                </div>
              )}

              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 mt-2 ml-auto" />
            </Link>
          )
        })}
      </section>

      {/* Charts */}
      <section className="space-y-6">
        {/* Bar chart — profitability per project */}
        <div className="rounded-2xl border bg-card p-4">
          <h2 className="text-sm font-semibold mb-1">Rentabilidad por proyecto</h2>
          <p className="text-xs text-muted-foreground mb-3">% de margen actual</p>
          <ProfitabilityBarChart data={chartBar} />
        </div>

        {/* Line chart — cost evolution */}
        <div className="rounded-2xl border bg-card p-4">
          <h2 className="text-sm font-semibold mb-1">Evolución de costos</h2>
          <p className="text-xs text-muted-foreground mb-3">Últimos 6 meses — materiales vs contratistas</p>
          <CostEvolutionChart data={chartEvolution} />
        </div>
      </section>
    </main>
  )
}
