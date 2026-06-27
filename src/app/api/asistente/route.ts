import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { db } from "@/lib/db"
import {
  projects,
  clients,
  invoice_allocations,
  contractor_payments,
  advances,
  project_rubros,
  work_cuts,
  invoices,
  quotes,
} from "@/lib/db/schema"
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm"
import { requireRole } from "@/lib/auth"
import { getAlerts } from "@/lib/alertas"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Eres el asistente financiero de Conceptos y Diseños, una firma de arquitectura y remodelación en Medellín, Colombia. Tu rol es ayudar a Carolina (la administradora) a entender el estado financiero de sus proyectos de construcción.

Tienes acceso a datos en tiempo real del sistema.
Responde siempre en español, de forma clara y concisa.
Usa formato de pesos colombianos (COP) con puntos como separadores de miles.
Si detectas problemas financieros, señálalos claramente.
Sé directo y práctico — Carolina necesita tomar decisiones rápidas en obra.`

function cop(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export async function POST(req: Request) {
  try {
    await requireRole(["admin"])

    const body = await req.json() as { message?: unknown; projectId?: unknown }
    const message = typeof body.message === "string" ? body.message.trim() : ""
    const projectId = typeof body.projectId === "string" ? body.projectId : undefined

    if (!message) {
      return NextResponse.json({ success: false, error: "Mensaje requerido" }, { status: 400 })
    }

    const now = Date.now()

    // Step 1: active projects list
    const activeProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
        quoted_amount: projects.quoted_amount,
        start_date: projects.start_date,
        estimated_end_date: projects.estimated_end_date,
        client_name: clients.name,
      })
      .from(projects)
      .leftJoin(clients, eq(clients.id, projects.client_id))
      .where(and(isNull(projects.deleted_at), ne(projects.status, "cancelled")))

    const projectIds = activeProjects.map((p) => p.id)

    // Step 2: parallel global queries
    const [systemAlerts, invoiceRows, contractorRows, advanceRows, pendingQuotes] =
      await Promise.all([
        getAlerts(),

        projectIds.length > 0
          ? db
              .select({
                project_id: invoice_allocations.project_id,
                total: sql<string>`coalesce(sum(${invoice_allocations.amount})::numeric, '0')`,
              })
              .from(invoice_allocations)
              .where(inArray(invoice_allocations.project_id, projectIds))
              .groupBy(invoice_allocations.project_id)
          : ([] as { project_id: string; total: string }[]),

        projectIds.length > 0
          ? db
              .select({
                project_id: contractor_payments.project_id,
                total: sql<string>`coalesce(sum(${contractor_payments.amount})::numeric, '0')`,
              })
              .from(contractor_payments)
              .where(inArray(contractor_payments.project_id, projectIds))
              .groupBy(contractor_payments.project_id)
          : ([] as { project_id: string; total: string }[]),

        projectIds.length > 0
          ? db
              .select({
                project_id: advances.project_id,
                total: sql<string>`coalesce(sum(${advances.amount})::numeric, '0')`,
              })
              .from(advances)
              .where(inArray(advances.project_id, projectIds))
              .groupBy(advances.project_id)
          : ([] as { project_id: string; total: string }[]),

        db
          .select({
            quote_number: quotes.quote_number,
            project_name: quotes.project_name,
            total_amount: quotes.total_amount,
            sent_at: quotes.sent_at,
            client_name: clients.name,
          })
          .from(quotes)
          .leftJoin(clients, eq(clients.id, quotes.client_id))
          .where(and(eq(quotes.status, "sent"), isNull(quotes.deleted_at))),
      ])

    // Build lookup maps
    const invoiceMap    = new Map(invoiceRows.map((r) => [r.project_id, parseFloat(r.total)]))
    const contractorMap = new Map(contractorRows.map((r) => [r.project_id, parseFloat(r.total)]))
    const advanceMap    = new Map(advanceRows.map((r) => [r.project_id, parseFloat(r.total)]))

    // Build context string
    let ctx = "=== DATOS FINANCIEROS EN TIEMPO REAL ===\n\n"

    ctx += `## PROYECTOS (${activeProjects.length})\n`
    for (const p of activeProjects) {
      const quoted       = parseFloat(p.quoted_amount)
      const invoiceCost  = invoiceMap.get(p.id) ?? 0
      const contractCost = contractorMap.get(p.id) ?? 0
      const totalCost    = invoiceCost + contractCost
      const adv          = advanceMap.get(p.id) ?? 0
      const margin       = quoted > 0 ? ((quoted - totalCost) / quoted) * 100 : 0
      const marginLabel  = margin > 15 ? "SALUDABLE" : margin >= 0 ? "EN RIESGO" : "EN PÉRDIDA"

      ctx += `\n### ${p.name} (cliente: ${p.client_name ?? "sin cliente"})\n`
      ctx += `- Estado: ${p.status} | Rentabilidad: ${marginLabel} — margen ${margin.toFixed(1)}%\n`
      ctx += `- Valor contrato: ${cop(quoted)} | Anticipo recibido: ${cop(adv)}\n`
      ctx += `- Facturas asignadas: ${cop(invoiceCost)} | Pagos a contratistas: ${cop(contractCost)}\n`
      ctx += `- Total egresos: ${cop(totalCost)} | Utilidad proyectada: ${cop(quoted - totalCost)}\n`
      ctx += `- Inicio: ${p.start_date} | Entrega estimada: ${p.estimated_end_date ?? "sin definir"}\n`
    }

    ctx += `\n## ALERTAS DEL SISTEMA (${systemAlerts.length})\n`
    if (systemAlerts.length === 0) {
      ctx += "- Sin alertas activas\n"
    } else {
      for (const a of systemAlerts) {
        ctx += `- [${a.severity.toUpperCase()}] ${a.message}\n`
      }
    }

    ctx += `\n## COTIZACIONES PENDIENTES DE RESPUESTA (${pendingQuotes.length})\n`
    if (pendingQuotes.length === 0) {
      ctx += "- Sin cotizaciones enviadas esperando respuesta\n"
    } else {
      for (const q of pendingQuotes) {
        const daysAgo = q.sent_at
          ? Math.floor((now - q.sent_at.getTime()) / (1000 * 60 * 60 * 24))
          : "?"
        ctx += `- ${q.quote_number}: ${q.project_name} | ${q.client_name ?? "sin cliente"} | ${cop(parseFloat(q.total_amount))} | enviada hace ${daysAgo} días\n`
      }
    }

    // Optional: full project detail
    if (projectId) {
      const target = activeProjects.find((p) => p.id === projectId)
      if (target) {
        const [rubros, projectInvoices, cuts] = await Promise.all([
          db
            .select({
              name: project_rubros.name,
              budget_amount: project_rubros.budget_amount,
              rubro_type: project_rubros.rubro_type,
            })
            .from(project_rubros)
            .where(and(eq(project_rubros.project_id, projectId), eq(project_rubros.active, true))),

          db
            .select({
              invoice_number: invoices.invoice_number,
              supplier_name: invoices.supplier_name,
              amount: invoice_allocations.amount,
            })
            .from(invoice_allocations)
            .innerJoin(invoices, eq(invoices.id, invoice_allocations.invoice_id))
            .where(eq(invoice_allocations.project_id, projectId)),

          db
            .select({
              cut_number: work_cuts.cut_number,
              status: work_cuts.status,
              total_executed: work_cuts.total_executed,
              cut_date: work_cuts.cut_date,
            })
            .from(work_cuts)
            .where(eq(work_cuts.project_id, projectId))
            .orderBy(work_cuts.cut_number),
        ])

        ctx += `\n## DETALLE COMPLETO: ${target.name}\n`

        if (rubros.length > 0) {
          ctx += "### Rubros de presupuesto:\n"
          for (const r of rubros) {
            ctx += `- ${r.name}: ${cop(parseFloat(r.budget_amount))}\n`
          }
        }

        if (projectInvoices.length > 0) {
          ctx += "### Facturas asignadas:\n"
          for (const f of projectInvoices) {
            ctx += `- ${f.invoice_number} (${f.supplier_name}): ${cop(parseFloat(f.amount))}\n`
          }
        }

        if (cuts.length > 0) {
          ctx += "### Cortes de obra:\n"
          for (const c of cuts) {
            ctx += `- Corte #${c.cut_number} [${c.status}] ${c.cut_date}: ejecutado ${cop(parseFloat(c.total_executed))}\n`
          }
        }
      }
    }

    ctx += "\n=== FIN DATOS ===\n"

    // Call Claude
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `${ctx}\nPREGUNTA DE CAROLINA:\n${message}`,
        },
      ],
    })

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : ""

    return NextResponse.json({ success: true, data: { response: text } })
  } catch (err) {
    console.error("[POST /api/asistente]", err)
    const msg = err instanceof Error ? err.message : "Error interno"
    const status =
      msg.startsWith("Forbidden") || msg.startsWith("Unauthorized") ? 403 : 500
    return NextResponse.json({ success: false, error: msg }, { status })
  }
}
