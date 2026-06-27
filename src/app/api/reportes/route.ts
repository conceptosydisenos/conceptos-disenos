import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  projects,
  clients,
  advances,
  invoice_allocations,
  contractor_payments,
  quotes,
} from "@/lib/db/schema"
import { and, eq, gte, inArray, isNull, ne, sql } from "drizzle-orm"
import { requireRole } from "@/lib/auth"

export interface ProjectReport {
  id: string
  name: string
  clientName: string
  status: string
  quotedAmount: number
  totalSpent: number
  marginPct: number
  semaphore: "green" | "amber" | "red"
}

export interface CashFlowMonth {
  month: string
  advances: number
  invoices: number
  contractors: number
  net: number
}

export interface PipelineStatus {
  count: number
  value: number
}

export interface ReportData {
  executive: {
    totalContracted: number
    totalAdvances: number
    totalSpent: number
    projectedProfit: number
    activeProjects: number
    closedProjects: number
    wonQuotes: number
    lostQuotes: number
    conversionRate: number
  }
  projects: ProjectReport[]
  cashFlow: CashFlowMonth[]
  pipeline: {
    draft: PipelineStatus
    sent: PipelineStatus
    approved: PipelineStatus
    rejected: PipelineStatus
    converted: PipelineStatus
    pipelineValue: number
    conversionRate: number
  }
}

export async function GET() {
  try {
    await requireRole(["admin"])

    const now = new Date()
    // First day of the month 5 months back → gives 6 months incl. current
    const sixMonthsAgo    = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const sixMonthsAgoStr = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, "0")}-01`

    const monthKeys: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    }

    // ── Step 1: all non-deleted projects ──────────────────────────
    const allProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
        quoted_amount: projects.quoted_amount,
        client_name: clients.name,
      })
      .from(projects)
      .leftJoin(clients, eq(clients.id, projects.client_id))
      .where(isNull(projects.deleted_at))

    const projectIds = allProjects.map((p) => p.id)

    // ── Step 2: parallel financial queries ────────────────────────
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
        .where(
          and(isNull(quotes.deleted_at), eq(quotes.is_current_version, true))
        )
        .groupBy(quotes.status),

      // Cash-flow: advances grouped by month
      db
        .select({
          month: sql<string>`to_char(date_trunc('month', ${advances.payment_date}::date), 'YYYY-MM')`,
          total: sql<string>`coalesce(sum(${advances.amount}), '0')`,
        })
        .from(advances)
        .where(gte(advances.payment_date, sixMonthsAgoStr))
        .groupBy(sql`date_trunc('month', ${advances.payment_date}::date)`)
        .orderBy(sql`date_trunc('month', ${advances.payment_date}::date)`),

      // Cash-flow: invoice allocations grouped by month (use created_at)
      db
        .select({
          month: sql<string>`to_char(date_trunc('month', ${invoice_allocations.created_at}), 'YYYY-MM')`,
          total: sql<string>`coalesce(sum(${invoice_allocations.amount}), '0')`,
        })
        .from(invoice_allocations)
        .where(gte(invoice_allocations.created_at, sixMonthsAgo))
        .groupBy(sql`date_trunc('month', ${invoice_allocations.created_at})`)
        .orderBy(sql`date_trunc('month', ${invoice_allocations.created_at})`),

      // Cash-flow: contractor payments grouped by month
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

    // ── Build lookup maps ──────────────────────────────────────────
    const advanceMap    = new Map(projectAdvances.map((r) => [r.project_id, parseFloat(r.total)]))
    const invoiceMap    = new Map(projectInvoices.map((r) => [r.project_id, parseFloat(r.total)]))
    const contractorMap = new Map(projectContractors.map((r) => [r.project_id, parseFloat(r.total)]))

    // ── Project summaries ──────────────────────────────────────────
    const CLOSED = ["completed", "in_warranty", "cancelled"]

    const projectReports: ProjectReport[] = allProjects.map((p) => {
      const quoted       = parseFloat(p.quoted_amount)
      const invoiceCost  = invoiceMap.get(p.id)    ?? 0
      const contractCost = contractorMap.get(p.id) ?? 0
      const totalSpent   = invoiceCost + contractCost
      const marginPct    = quoted > 0 ? ((quoted - totalSpent) / quoted) * 100 : 0
      return {
        id:          p.id,
        name:        p.name,
        clientName:  p.client_name ?? "Sin cliente",
        status:      p.status,
        quotedAmount: quoted,
        totalSpent,
        marginPct,
        semaphore: marginPct > 15 ? "green" : marginPct >= 0 ? "amber" : "red",
      }
    })

    // ── Executive totals ───────────────────────────────────────────
    const totalContracted = allProjects
      .filter((p) => p.status !== "cancelled")
      .reduce((s, p) => s + parseFloat(p.quoted_amount), 0)
    const totalAdvances   = Array.from(advanceMap.values()).reduce((a, b) => a + b, 0)
    const totalSpent      = projectReports.reduce((s, p) => s + p.totalSpent, 0)

    // ── Quote pipeline ─────────────────────────────────────────────
    const qMap = new Map(
      quotesByStatus.map((r) => [r.status, { count: r.count, value: parseFloat(r.value) }])
    )
    type QStatus = "draft" | "sent" | "approved" | "rejected" | "converted"
    const entry = (s: QStatus) => qMap.get(s) ?? { count: 0, value: 0 }

    const wonQuotes  = (entry("converted").count) + (entry("approved").count)
    const lostQuotes = entry("rejected").count
    const decided    = wonQuotes + lostQuotes
    const quoteConversionRate = decided > 0 ? (wonQuotes / decided) * 100 : 0
    const pipelineValue = entry("sent").value + entry("approved").value

    // ── Cash flow ──────────────────────────────────────────────────
    const advByMonth = new Map(advancesByMonth.map((r)    => [r.month, parseFloat(r.total)]))
    const invByMonth = new Map(invoicesByMonth.map((r)    => [r.month, parseFloat(r.total)]))
    const conByMonth = new Map(contractorsByMonth.map((r) => [r.month, parseFloat(r.total)]))

    const cashFlow: CashFlowMonth[] = monthKeys.map((month) => {
      const adv = advByMonth.get(month) ?? 0
      const inv = invByMonth.get(month) ?? 0
      const con = conByMonth.get(month) ?? 0
      return { month, advances: adv, invoices: inv, contractors: con, net: adv - inv - con }
    })

    const data: ReportData = {
      executive: {
        totalContracted,
        totalAdvances,
        totalSpent,
        projectedProfit: totalContracted - totalSpent,
        activeProjects:  allProjects.filter((p) => !CLOSED.includes(p.status)).length,
        closedProjects:  allProjects.filter((p) => CLOSED.includes(p.status)).length,
        wonQuotes,
        lostQuotes,
        conversionRate: quoteConversionRate,
      },
      projects: projectReports,
      cashFlow,
      pipeline: {
        draft:     entry("draft"),
        sent:      entry("sent"),
        approved:  entry("approved"),
        rejected:  entry("rejected"),
        converted: entry("converted"),
        pipelineValue,
        conversionRate: quoteConversionRate,
      },
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error("[GET /api/reportes]", err)
    const msg    = err instanceof Error ? err.message : "Error interno"
    const status = msg.startsWith("Forbidden") || msg.startsWith("Unauthorized") ? 403 : 500
    return NextResponse.json({ success: false, error: msg }, { status })
  }
}
