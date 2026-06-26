import { db } from "./db"
import {
  projects,
  invoice_allocations,
  contractor_payments,
  advances,
  project_rubros,
  invoices,
  quotes,
} from "./db/schema"
import { and, eq, gt, inArray, isNull, isNotNull, lt, ne, sql } from "drizzle-orm"
import { formatCOP } from "./utils"

export type AlertSeverity = "critica" | "alta" | "media" | "baja"

export interface SystemAlert {
  type: string
  severity: AlertSeverity
  message: string
  project_id?: string
  quote_id?: string
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critica: 0,
  alta: 1,
  media: 2,
  baja: 3,
}

const FIVE_DAYS_MS  = 5 * 24 * 60 * 60 * 1000
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export async function getAlerts(): Promise<SystemAlert[]> {
  const now = Date.now()
  const fiveDaysAgo  = new Date(now - FIVE_DAYS_MS)
  const sevenDaysAgo = new Date(now - SEVEN_DAYS_MS)

  const [activeProjects, unassignedRow, oldQuotes] = await Promise.all([
    db
      .select({ id: projects.id, name: projects.name, quoted_amount: projects.quoted_amount })
      .from(projects)
      .where(and(isNull(projects.deleted_at), ne(projects.status, "cancelled"))),

    db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(
        and(
          eq(invoices.status, "pending_allocation"),
          lt(invoices.created_at, fiveDaysAgo),
        )
      ),

    db
      .select({ id: quotes.id, quote_number: quotes.quote_number, sent_at: quotes.sent_at })
      .from(quotes)
      .where(
        and(
          eq(quotes.status, "sent"),
          isNull(quotes.deleted_at),
          isNotNull(quotes.sent_at),
          sql`${quotes.sent_at} < ${sevenDaysAgo}`,
        )
      ),
  ])

  const alerts: SystemAlert[] = []

  // ── Alert 4: unassigned invoices > 5 days ────────────────────
  const oldUnassigned = unassignedRow[0]?.count ?? 0
  if (oldUnassigned > 0) {
    alerts.push({
      type: "facturas_sin_asignar",
      severity: "media",
      message: `Tienes ${oldUnassigned} factura${oldUnassigned !== 1 ? "s" : ""} sin asignar hace más de 5 días`,
    })
  }

  // ── Alert 6: quotes without response > 7 days ────────────────
  for (const q of oldQuotes) {
    const daysAgo = Math.floor((now - (q.sent_at?.getTime() ?? 0)) / (1000 * 60 * 60 * 24))
    alerts.push({
      type: "cotizacion_sin_respuesta",
      severity: "baja",
      message: `La cotización ${q.quote_number} lleva ${daysAgo} día${daysAgo !== 1 ? "s" : ""} sin respuesta del cliente`,
      quote_id: q.id,
    })
  }

  const projectIds = activeProjects.map(p => p.id)
  if (projectIds.length === 0) {
    return alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  }

  const [invoiceRows, contractorRows, advanceRows, rubrosRows] = await Promise.all([
    db
      .select({
        project_id: invoice_allocations.project_id,
        total: sql<string>`coalesce(sum(${invoice_allocations.amount})::numeric, '0')`,
      })
      .from(invoice_allocations)
      .where(inArray(invoice_allocations.project_id, projectIds))
      .groupBy(invoice_allocations.project_id),

    db
      .select({
        project_id: contractor_payments.project_id,
        total: sql<string>`coalesce(sum(${contractor_payments.amount})::numeric, '0')`,
      })
      .from(contractor_payments)
      .where(inArray(contractor_payments.project_id, projectIds))
      .groupBy(contractor_payments.project_id),

    db
      .select({
        project_id: advances.project_id,
        total: sql<string>`coalesce(sum(${advances.amount})::numeric, '0')`,
      })
      .from(advances)
      .where(inArray(advances.project_id, projectIds))
      .groupBy(advances.project_id),

    db
      .select({
        id:            project_rubros.id,
        name:          project_rubros.name,
        budget_amount: project_rubros.budget_amount,
        project_id:    project_rubros.project_id,
        spent: sql<string>`coalesce(sum(${invoice_allocations.amount})::numeric, '0')`,
      })
      .from(project_rubros)
      .leftJoin(invoice_allocations, eq(invoice_allocations.project_rubro_id, project_rubros.id))
      .where(
        and(
          inArray(project_rubros.project_id, projectIds),
          eq(project_rubros.active, true),
          gt(project_rubros.budget_amount, "0"),
        )
      )
      .groupBy(
        project_rubros.id,
        project_rubros.name,
        project_rubros.budget_amount,
        project_rubros.project_id,
      ),
  ])

  const invoiceMap    = new Map(invoiceRows.map(r    => [r.project_id,    parseFloat(r.total)]))
  const contractorMap = new Map(contractorRows.map(r => [r.project_id,    parseFloat(r.total)]))
  const advanceMap    = new Map(advanceRows.map(r    => [r.project_id,    parseFloat(r.total)]))
  const projectNameMap = new Map(activeProjects.map(p => [p.id, p.name]))

  for (const p of activeProjects) {
    const quoted = parseFloat(p.quoted_amount)
    if (quoted <= 0) continue

    const invoiceTotal    = invoiceMap.get(p.id)    ?? 0
    const contractorTotal = contractorMap.get(p.id) ?? 0
    const totalEgresos    = invoiceTotal + contractorTotal
    const totalAdvances   = advanceMap.get(p.id)    ?? 0
    const margin          = ((quoted - totalEgresos) / quoted) * 100

    // Alert 1: project in loss
    if (totalEgresos > quoted) {
      alerts.push({
        type: "proyecto_en_perdida",
        severity: "critica",
        message: `El proyecto "${p.name}" está en pérdida. Gastado: ${formatCOP(totalEgresos)} — Contrato: ${formatCOP(quoted)}`,
        project_id: p.id,
      })
    }

    // Alert 3: margin < 15% (but not already in loss)
    if (totalEgresos <= quoted && margin < 15) {
      alerts.push({
        type: "proyecto_en_riesgo",
        severity: "media",
        message: `El proyecto "${p.name}" tiene margen de solo ${margin.toFixed(1)}% — revisar gastos`,
        project_id: p.id,
      })
    }

    // Alert 5: advance exhausted
    if (totalAdvances > 0 && totalEgresos > totalAdvances) {
      alerts.push({
        type: "anticipo_agotado",
        severity: "media",
        message: `El anticipo del proyecto "${p.name}" se agotó — considerar solicitar nuevo pago`,
        project_id: p.id,
      })
    }
  }

  // Alert 2: rubro over budget
  for (const rubro of rubrosRows) {
    const spent  = parseFloat(rubro.spent)
    const budget = parseFloat(rubro.budget_amount)
    if (spent > budget) {
      const over        = spent - budget
      const projectName = projectNameMap.get(rubro.project_id) ?? "—"
      alerts.push({
        type: "rubro_sobrepresupuestado",
        severity: "alta",
        message: `Rubro "${rubro.name}" en proyecto "${projectName}" superó el presupuesto en ${formatCOP(over)}`,
        project_id: rubro.project_id,
      })
    }
  }

  return alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
}
