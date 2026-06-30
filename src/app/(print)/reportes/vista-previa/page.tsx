import { db } from "@/lib/db"
import { projects, clients, advances, invoice_allocations, contractor_payments, quotes } from "@/lib/db/schema"
import { and, gte, inArray, isNull, sql } from "drizzle-orm"
import { requireRole } from "@/lib/auth"
import { redirect } from "next/navigation"
import { PrintButton } from "./PrintButton"
import "./vista-previa.css"

const NAVY  = "#1C2333"
const GREEN = "#2D9B6F"

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)

function monthLabel(ym: string): string {
  const [year, month] = ym.split("-")
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("es-CO", {
    month: "short",
    year: "numeric",
  })
}

const STATUS_LABEL: Record<string, string> = {
  active:      "Activo",
  paused:      "Pausado",
  completed:   "Completado",
  in_warranty: "Garantía",
  cancelled:   "Cancelado",
}

const SEMAPHORE_COLOR: Record<string, string> = {
  green: GREEN,
  amber: "#D97706",
  red:   "#DC2626",
}

export default async function ReportesVistaPrevia() {
  try {
    await requireRole(["admin"])
  } catch {
    redirect("/sign-in")
  }

  const now = new Date()
  const sixMonthsAgo    = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const sixMonthsAgoStr = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, "0")}-01`

  const monthKeys: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }

  const allProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      quoted_amount: projects.quoted_amount,
      client_name: clients.name,
    })
    .from(projects)
    .leftJoin(clients, sql`${clients.id} = ${projects.client_id}`)
    .where(isNull(projects.deleted_at))

  const projectIds = allProjects.map((p) => p.id)

  const [
    projectAdvances,
    projectInvoices,
    projectContractors,
    quotesByStatus,
    advancesByMonth,
    invoicesByMonth,
    contractorsByMonth,
  ] = await Promise.all([
    projectIds.length > 0
      ? db
          .select({
            project_id: advances.project_id,
            total: sql<string>`coalesce(sum(${advances.amount}), '0')`,
          })
          .from(advances)
          .where(inArray(advances.project_id, projectIds))
          .groupBy(advances.project_id)
      : ([] as { project_id: string; total: string }[]),

    projectIds.length > 0
      ? db
          .select({
            project_id: invoice_allocations.project_id,
            total: sql<string>`coalesce(sum(${invoice_allocations.amount}), '0')`,
          })
          .from(invoice_allocations)
          .where(inArray(invoice_allocations.project_id, projectIds))
          .groupBy(invoice_allocations.project_id)
      : ([] as { project_id: string; total: string }[]),

    projectIds.length > 0
      ? db
          .select({
            project_id: contractor_payments.project_id,
            total: sql<string>`coalesce(sum(${contractor_payments.amount}), '0')`,
          })
          .from(contractor_payments)
          .where(inArray(contractor_payments.project_id, projectIds))
          .groupBy(contractor_payments.project_id)
      : ([] as { project_id: string; total: string }[]),

    db
      .select({
        status: quotes.status,
        count: sql<number>`count(*)::int`,
        value: sql<string>`coalesce(sum(${quotes.total_amount}), '0')`,
      })
      .from(quotes)
      .where(and(isNull(quotes.deleted_at), sql`${quotes.is_current_version} = true`))
      .groupBy(quotes.status),

    db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${advances.payment_date}::date), 'YYYY-MM')`,
        total: sql<string>`coalesce(sum(${advances.amount}), '0')`,
      })
      .from(advances)
      .where(gte(advances.payment_date, sixMonthsAgoStr))
      .groupBy(sql`date_trunc('month', ${advances.payment_date}::date)`)
      .orderBy(sql`date_trunc('month', ${advances.payment_date}::date)`),

    db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${invoice_allocations.created_at}), 'YYYY-MM')`,
        total: sql<string>`coalesce(sum(${invoice_allocations.amount}), '0')`,
      })
      .from(invoice_allocations)
      .where(gte(invoice_allocations.created_at, sixMonthsAgo))
      .groupBy(sql`date_trunc('month', ${invoice_allocations.created_at})`)
      .orderBy(sql`date_trunc('month', ${invoice_allocations.created_at})`),

    db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${contractor_payments.payment_date}::date), 'YYYY-MM')`,
        total: sql<string>`coalesce(sum(${contractor_payments.amount}), '0')`,
      })
      .from(contractor_payments)
      .where(gte(contractor_payments.payment_date, sixMonthsAgoStr))
      .groupBy(sql`date_trunc('month', ${contractor_payments.payment_date}::date)`)
      .orderBy(sql`date_trunc('month', ${contractor_payments.payment_date}::date)`),
  ])

  // Build lookup maps
  const advanceMap    = new Map(projectAdvances.map((r) => [r.project_id, parseFloat(r.total)]))
  const invoiceMap    = new Map(projectInvoices.map((r) => [r.project_id, parseFloat(r.total)]))
  const contractorMap = new Map(projectContractors.map((r) => [r.project_id, parseFloat(r.total)]))

  const CLOSED = ["completed", "in_warranty", "cancelled"]

  const projectReports = allProjects.map((p) => {
    const quoted       = parseFloat(p.quoted_amount)
    const invoiceCost  = invoiceMap.get(p.id)    ?? 0
    const contractCost = contractorMap.get(p.id) ?? 0
    const totalSpent   = invoiceCost + contractCost
    const marginPct    = quoted > 0 ? ((quoted - totalSpent) / quoted) * 100 : 0
    const semaphore    = marginPct > 15 ? "green" : marginPct >= 0 ? "amber" : "red"
    return { id: p.id, name: p.name, clientName: p.client_name ?? "Sin cliente", status: p.status, quoted, totalSpent, marginPct, semaphore }
  })

  const totalContracted = allProjects
    .filter((p) => p.status !== "cancelled")
    .reduce((s, p) => s + parseFloat(p.quoted_amount), 0)
  const totalAdvances = Array.from(advanceMap.values()).reduce((a, b) => a + b, 0)
  const totalSpent    = projectReports.reduce((s, p) => s + p.totalSpent, 0)

  const qMap = new Map(
    quotesByStatus.map((r) => [r.status, { count: r.count, value: parseFloat(r.value) }])
  )
  type QStatus = "draft" | "sent" | "approved" | "rejected" | "converted"
  const entry = (s: QStatus) => qMap.get(s) ?? { count: 0, value: 0 }

  const wonQuotes  = entry("converted").count + entry("approved").count
  const lostQuotes = entry("rejected").count
  const decided    = wonQuotes + lostQuotes
  const convRate   = decided > 0 ? (wonQuotes / decided) * 100 : 0

  const pipelineStatuses = [
    { key: "draft" as QStatus,     label: "Borrador" },
    { key: "sent" as QStatus,      label: "Enviada" },
    { key: "approved" as QStatus,  label: "Aprobada" },
    { key: "rejected" as QStatus,  label: "Rechazada" },
    { key: "converted" as QStatus, label: "Convertida" },
  ]

  const advByMonth = new Map(advancesByMonth.map((r)    => [r.month, parseFloat(r.total)]))
  const invByMonth = new Map(invoicesByMonth.map((r)    => [r.month, parseFloat(r.total)]))
  const conByMonth = new Map(contractorsByMonth.map((r) => [r.month, parseFloat(r.total)]))

  const cashFlow = monthKeys.map((month) => {
    const adv = advByMonth.get(month) ?? 0
    const inv = invByMonth.get(month) ?? 0
    const con = conByMonth.get(month) ?? 0
    return { month, advances: adv, invoices: inv, contractors: con, net: adv - inv - con }
  })

  const generatedDate = now.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })

  const tdStyle = { padding: "7px 10px", borderBottom: "1px solid #E5E7EB", fontSize: "11px", color: "#374151" }
  const thStyle = { padding: "7px 10px", backgroundColor: "#F9FAFB", fontSize: "10px", fontWeight: "700" as const, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: "#6B7280", borderBottom: "1px solid #E5E7EB" }

  return (
    <div className="rp-wrap">
      <div className="rp-card">

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `2.5px solid ${NAVY}`, paddingBottom: "16px", marginBottom: "22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="Logo" width={80} height={80} style={{ objectFit: "contain" }} />
            <div>
              <div style={{ fontSize: "15px", fontWeight: "700", color: NAVY }}>Conceptos y Diseños</div>
              <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "2px" }}>Arquitectura &amp; Remodelación</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "20px", fontWeight: "700", color: NAVY, letterSpacing: "0.05em" }}>REPORTE GERENCIAL</div>
            <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "4px" }}>Generado el {generatedDate}</div>
          </div>
        </div>

        {/* Section 1: Executive KPIs */}
        <div className="rp-section">
          <div className="rp-section-title">Resumen Ejecutivo</div>
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #E5E7EB", borderRadius: "6px", overflow: "hidden" }}>
            <tbody>
              <tr>
                <td style={{ ...tdStyle, width: "33%", fontWeight: "600", color: "#111827" }}>
                  <div style={{ fontSize: "10px", color: "#9CA3AF", marginBottom: "2px" }}>Valor total contratado</div>
                  <div style={{ fontSize: "15px", fontWeight: "700", color: NAVY, fontVariantNumeric: "tabular-nums" }}>{fmt(totalContracted)}</div>
                </td>
                <td style={{ ...tdStyle, width: "33%", borderLeft: "1px solid #E5E7EB" }}>
                  <div style={{ fontSize: "10px", color: "#9CA3AF", marginBottom: "2px" }}>Total anticipos cobrados</div>
                  <div style={{ fontSize: "15px", fontWeight: "700", color: NAVY, fontVariantNumeric: "tabular-nums" }}>{fmt(totalAdvances)}</div>
                </td>
                <td style={{ ...tdStyle, width: "34%", borderLeft: "1px solid #E5E7EB" }}>
                  <div style={{ fontSize: "10px", color: "#9CA3AF", marginBottom: "2px" }}>Total gastado</div>
                  <div style={{ fontSize: "15px", fontWeight: "700", color: "#DC2626", fontVariantNumeric: "tabular-nums" }}>{fmt(totalSpent)}</div>
                </td>
              </tr>
              <tr>
                <td style={{ ...tdStyle, borderBottom: "none" }}>
                  <div style={{ fontSize: "10px", color: "#9CA3AF", marginBottom: "2px" }}>Utilidad proyectada</div>
                  <div style={{ fontSize: "15px", fontWeight: "700", color: totalContracted - totalSpent >= 0 ? GREEN : "#DC2626", fontVariantNumeric: "tabular-nums" }}>{fmt(totalContracted - totalSpent)}</div>
                </td>
                <td style={{ ...tdStyle, borderBottom: "none", borderLeft: "1px solid #E5E7EB" }}>
                  <div style={{ fontSize: "10px", color: "#9CA3AF", marginBottom: "2px" }}>Proyectos activos / cerrados</div>
                  <div style={{ fontSize: "15px", fontWeight: "700", color: NAVY }}>
                    {allProjects.filter((p) => !CLOSED.includes(p.status)).length} / {allProjects.filter((p) => CLOSED.includes(p.status)).length}
                  </div>
                </td>
                <td style={{ ...tdStyle, borderBottom: "none", borderLeft: "1px solid #E5E7EB" }}>
                  <div style={{ fontSize: "10px", color: "#9CA3AF", marginBottom: "2px" }}>Tasa de conversión</div>
                  <div style={{ fontSize: "15px", fontWeight: "700", color: convRate >= 50 ? GREEN : convRate > 0 ? "#D97706" : NAVY }}>{convRate.toFixed(0)}%</div>
                  <div style={{ fontSize: "10px", color: "#9CA3AF" }}>{wonQuotes}G / {lostQuotes}P</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 2: Projects */}
        <div className="rp-section">
          <div className="rp-section-title">Estado por Proyecto</div>
          {projectReports.length === 0 ? (
            <div style={{ padding: "16px", textAlign: "center", fontSize: "12px", color: "#9CA3AF", border: "1px solid #E5E7EB", borderRadius: "6px" }}>
              Sin proyectos registrados
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #E5E7EB" }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: "left" }}>Proyecto</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>Cliente</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Contrato</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Gastado</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Margen</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {projectReports.map((p, i) => (
                  <tr key={p.id} style={{ backgroundColor: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                    <td style={{ ...tdStyle, borderBottom: i === projectReports.length - 1 ? "none" : undefined }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: SEMAPHORE_COLOR[p.semaphore], flexShrink: 0 }} />
                        <span style={{ fontWeight: "600", color: "#111827" }}>{p.name}</span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, color: "#6B7280", borderBottom: i === projectReports.length - 1 ? "none" : undefined }}>{p.clientName}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums", borderBottom: i === projectReports.length - 1 ? "none" : undefined }}>{fmt(p.quoted)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums", borderBottom: i === projectReports.length - 1 ? "none" : undefined }}>{fmt(p.totalSpent)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: "600", color: SEMAPHORE_COLOR[p.semaphore], borderBottom: i === projectReports.length - 1 ? "none" : undefined }}>{p.marginPct.toFixed(1)}%</td>
                    <td style={{ ...tdStyle, textAlign: "center", borderBottom: i === projectReports.length - 1 ? "none" : undefined }}>
                      <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "10px", backgroundColor: "#F3F4F6", color: "#374151" }}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Section 3: Cash Flow */}
        <div className="rp-section">
          <div className="rp-section-title">Flujo de Caja — Últimos 6 Meses</div>
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #E5E7EB" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: "left" }}>Mes</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Anticipos</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Facturas</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Contratistas</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Neto</th>
              </tr>
            </thead>
            <tbody>
              {cashFlow.map((m, i) => (
                <tr key={m.month} style={{ backgroundColor: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                  <td style={{ ...tdStyle, fontWeight: "600", color: "#111827", borderBottom: i === cashFlow.length - 1 ? "none" : undefined }}>{monthLabel(m.month)}</td>
                  <td style={{ ...tdStyle, textAlign: "right", color: GREEN, fontVariantNumeric: "tabular-nums", borderBottom: i === cashFlow.length - 1 ? "none" : undefined }}>{fmt(m.advances)}</td>
                  <td style={{ ...tdStyle, textAlign: "right", color: "#DC2626", fontVariantNumeric: "tabular-nums", borderBottom: i === cashFlow.length - 1 ? "none" : undefined }}>{fmt(m.invoices)}</td>
                  <td style={{ ...tdStyle, textAlign: "right", color: "#D97706", fontVariantNumeric: "tabular-nums", borderBottom: i === cashFlow.length - 1 ? "none" : undefined }}>{fmt(m.contractors)}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: "700", fontVariantNumeric: "tabular-nums", color: m.net >= 0 ? GREEN : "#DC2626", borderBottom: i === cashFlow.length - 1 ? "none" : undefined }}>
                    {m.net >= 0 ? "+" : ""}{fmt(m.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section 4: Pipeline */}
        <div className="rp-section">
          <div className="rp-section-title">Pipeline de Cotizaciones</div>
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #E5E7EB" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: "left" }}>Estado</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Cantidad</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {pipelineStatuses.map(({ key, label }, i) => {
                const d = entry(key)
                const isLast = i === pipelineStatuses.length - 1
                return (
                  <tr key={key} style={{ backgroundColor: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                    <td style={{ ...tdStyle, fontWeight: "500", borderBottom: isLast ? "none" : undefined }}>{label}</td>
                    <td style={{ ...tdStyle, textAlign: "right", borderBottom: isLast ? "none" : undefined }}>{d.count}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums", borderBottom: isLast ? "none" : undefined }}>{fmt(d.value)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: "#F0FDF9" }}>
                <td style={{ padding: "8px 10px", fontSize: "11px", fontWeight: "700", color: NAVY, borderTop: `2px solid ${GREEN}` }}>
                  En pipeline (enviadas + aprobadas)
                </td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontSize: "11px", fontWeight: "700", color: NAVY, borderTop: `2px solid ${GREEN}` }}>
                  {(entry("sent").count + entry("approved").count)}
                </td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontSize: "11px", fontWeight: "700", color: GREEN, fontVariantNumeric: "tabular-nums", borderTop: `2px solid ${GREEN}` }}>
                  {fmt(entry("sent").value + entry("approved").value)}
                </td>
              </tr>
              <tr>
                <td colSpan={3} style={{ padding: "6px 10px", fontSize: "10px", color: "#6B7280", borderTop: "1px solid #E5E7EB" }}>
                  Tasa de conversión: {convRate.toFixed(0)}% — {wonQuotes} ganadas / {lostQuotes} perdidas
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer */}
        <div className="rp-footer">
          <span>Generado el {generatedDate} — Conceptos y Diseños</span>
          <span>Confidencial</span>
        </div>

      </div>

      <PrintButton />
    </div>
  )
}
