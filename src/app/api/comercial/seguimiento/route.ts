import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { requireRole } from "@/lib/auth"

const STAGE_ORDER = ["new", "contacted", "visit_scheduled", "quoted", "won", "lost"] as const
const STAGE_LABELS: Record<string, string> = {
  new:            "Nuevo",
  contacted:      "Contactado",
  visit_scheduled:"Visita",
  quoted:         "Cotización",
  won:            "Ganado",
  lost:           "Perdido",
}

type PipelineRow      = { status: string; count: number; total_value: string }
type PendingQuoteRow  = { id: string; quote_number: string; project_name: string; total_amount: string; client_name: string | null; days_waiting: number }
type ConversionRow    = { converted_count: number; total_sent: number }
type AdvanceRow       = { month: string; advance_total: string }

export async function GET() {
  try {
    await requireRole(["admin"])

    const sql = neon(process.env.DATABASE_URL!)

    // 1. Pipeline: count and value per lead stage
    const pipelineRows = await sql`
      SELECT
        status,
        COUNT(*)::int                                        AS count,
        COALESCE(SUM(estimated_value::numeric), 0)::numeric AS total_value
      FROM leads
      WHERE deleted_at IS NULL
      GROUP BY status
      HAVING COUNT(*) > 0
    ` as PipelineRow[]

    const pipeline = STAGE_ORDER
      .map(status => {
        const row = pipelineRows.find(r => r.status === status)
        if (!row) return null
        return {
          status,
          label:       STAGE_LABELS[status] ?? status,
          count:       row.count,
          total_value: parseFloat(row.total_value),
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    // 2. Quotes in "sent" status with no response for >7 days
    const pendingRows = await sql`
      SELECT
        q.id,
        q.quote_number,
        q.project_name,
        q.total_amount,
        COALESCE(l.contact_name, c.name, q.contact_name) AS client_name,
        EXTRACT(DAY FROM (NOW() - q.sent_at))::int        AS days_waiting
      FROM quotes q
      LEFT JOIN leads   l ON q.lead_id   = l.id
      LEFT JOIN clients c ON q.client_id = c.id
      WHERE q.status       = 'sent'
        AND q.deleted_at  IS NULL
        AND q.sent_at     IS NOT NULL
        AND q.sent_at      < NOW() - INTERVAL '7 days'
      ORDER BY q.total_amount::numeric DESC
    ` as PendingQuoteRow[]

    // 3. Conversion rate: converted / total ever sent
    const [convRow] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'converted')::int                              AS converted_count,
        COUNT(*) FILTER (WHERE status IN ('sent','approved','rejected','converted'))::int AS total_sent
      FROM quotes
      WHERE deleted_at IS NULL AND is_current_version = true
    ` as ConversionRow[]

    const converted_count = convRow?.converted_count ?? 0
    const total_sent      = convRow?.total_sent      ?? 0
    const rate = total_sent > 0 ? Math.round((converted_count / total_sent) * 100) : 0

    // 4. Projected advances for next 3 months (based on quote created_at)
    const advanceRows = await sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
        SUM(advance_amount::numeric)::numeric                AS advance_total
      FROM quotes
      WHERE status IN ('sent', 'approved')
        AND deleted_at IS NULL
        AND is_current_version = true
        AND DATE_TRUNC('month', created_at) >= DATE_TRUNC('month', NOW())
        AND DATE_TRUNC('month', created_at)  < DATE_TRUNC('month', NOW()) + INTERVAL '3 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY 1
    ` as AdvanceRow[]

    return NextResponse.json({
      success: true,
      data: {
        pipeline,
        pendingQuotes: pendingRows.map(r => ({
          id:           r.id,
          quote_number: r.quote_number,
          project_name: r.project_name,
          total_amount: parseFloat(r.total_amount),
          client_name:  r.client_name ?? "—",
          days_waiting: r.days_waiting,
        })),
        conversion: { converted_count, total_sent, rate },
        projectedAdvances: advanceRows.map(r => ({
          month:         r.month,
          advance_total: parseFloat(r.advance_total),
        })),
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Forbidden")) {
      return NextResponse.json({ success: false, error: "Solo administradores" }, { status: 403 })
    }
    return NextResponse.json({ success: false, error: "Error al cargar seguimiento comercial" }, { status: 500 })
  }
}
