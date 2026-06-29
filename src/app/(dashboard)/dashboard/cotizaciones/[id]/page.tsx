import { db } from "@/lib/db"
import { quotes, quote_items, clients, projects, quote_rubros } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { and, asc, eq, isNull } from "drizzle-orm"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, ExternalLink } from "lucide-react"
import { QuoteItemsEditor } from "@/components/cotizaciones/QuoteItemsEditor"
import { QuoteActions } from "@/components/cotizaciones/QuoteActions"
import { formatCOP } from "@/lib/utils"

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft:     { label: "Borrador",   className: "bg-muted text-muted-foreground" },
  sent:      { label: "Enviada",    className: "bg-blue-100 text-blue-700" },
  approved:  { label: "Aprobada",   className: "bg-emerald-100 text-emerald-700" },
  rejected:  { label: "Rechazada",  className: "bg-destructive/10 text-destructive" },
  converted: { label: "Convertida", className: "bg-violet-100 text-violet-700" },
}

interface Props {
  params: { id: string }
}

export default async function CotizacionDetailPage({ params }: Props) {
  const user = await requireAuth()
  const isAdmin = user.role === "admin"

  const [quote] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, params.id), isNull(quotes.deleted_at)))

  if (!quote) notFound()

  const items = await db
    .select()
    .from(quote_items)
    .where(eq(quote_items.quote_id, params.id))
    .orderBy(asc(quote_items.sort_order), asc(quote_items.created_at))

  const [client] = quote.client_id
    ? await db.select({ name: clients.name }).from(clients).where(eq(clients.id, quote.client_id))
    : []

  const [project] = quote.converted_to_project_id
    ? await db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(eq(projects.id, quote.converted_to_project_id))
    : []

  const rubros = await db
    .select({
      id: quote_rubros.id,
      name: quote_rubros.name,
      budget_amount: quote_rubros.budget_amount,
    })
    .from(quote_rubros)
    .where(and(eq(quote_rubros.quote_id, params.id), eq(quote_rubros.active, true)))
    .orderBy(asc(quote_rubros.sort_order))

  const itemsByRubroId = new Map<string, typeof items>()
  for (const item of items) {
    if (item.quote_rubro_id) {
      const existing = itemsByRubroId.get(item.quote_rubro_id) ?? []
      existing.push(item)
      itemsByRubroId.set(item.quote_rubro_id, existing)
    }
  }

  const cfg = STATUS_CONFIG[quote.status] ?? STATUS_CONFIG.draft
  const isDraft = quote.status === "draft"
  const hasRubros = rubros.some(r => parseFloat(r.budget_amount) > 0)

  return (
    <main className="px-4 pt-6 pb-24 md:px-8 max-w-2xl mx-auto space-y-5">
      {/* Back + header */}
      <div className="flex items-start gap-3">
        <Link href="/dashboard/cotizaciones" className="p-1.5 -ml-1.5 mt-0.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors shrink-0">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">{quote.quote_number}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.className}`}>
              {cfg.label}
            </span>
          </div>
          <h1 className="text-xl font-bold text-foreground mt-1 leading-tight">{quote.project_name}</h1>
        </div>
        {isAdmin && isDraft && (
          <Link
            href={`/dashboard/cotizaciones/${params.id}/editar`}
            className="shrink-0 mt-0.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors font-medium whitespace-nowrap"
          >
            Editar
          </Link>
        )}
      </div>

      {/* Converted → link to project */}
      {quote.status === "converted" && project && (
        <div className="section-card bg-violet-50 border-violet-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-violet-700 uppercase tracking-wider">Proyecto creado</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{project.name}</p>
            </div>
            <Link
              href={`/dashboard/proyectos/${project.id}`}
              className="flex items-center gap-1 text-xs text-violet-700 font-medium hover:underline"
            >
              Ver proyecto <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Contact info */}
      <div className="section-card space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contacto</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          {(quote.contact_name || client?.name) && (
            <div>
              <p className="text-xs text-muted-foreground">Nombre</p>
              <p className="font-medium mt-0.5">{client?.name ?? quote.contact_name}</p>
            </div>
          )}
          {quote.contact_phone && (
            <div>
              <p className="text-xs text-muted-foreground">Teléfono</p>
              <a href={`tel:${quote.contact_phone}`} className="font-medium mt-0.5 text-primary hover:underline block">
                {quote.contact_phone}
              </a>
            </div>
          )}
          {quote.contact_email && (
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <a href={`mailto:${quote.contact_email}`} className="font-medium mt-0.5 text-primary hover:underline block truncate">
                {quote.contact_email}
              </a>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Válida hasta</p>
            <p className="font-medium mt-0.5">
              {new Date(quote.valid_until).toLocaleDateString("es-CO", {
                day: "numeric", month: "long", year: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Description */}
      {quote.description && (
        <div className="section-card">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Descripción</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{quote.description}</p>
        </div>
      )}

      {/* Rubros y Presupuesto */}
      {rubros.length > 0 && (() => {
        const total = rubros.reduce((sum, r) => sum + (parseFloat(r.budget_amount) > 0 ? parseFloat(r.budget_amount) : 0), 0)
        return (
          <div className="section-card">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Rubros y Presupuesto</p>
            <div className="divide-y divide-border">
              {rubros.map((r) => {
                const amount = parseFloat(r.budget_amount)
                const rubroItems = itemsByRubroId.get(r.id) ?? []
                return (
                  <div key={r.id} className="py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{r.name}</span>
                      {amount > 0
                        ? <span className="text-sm font-medium tabular-nums">{formatCOP(amount)}</span>
                        : <span className="text-sm text-muted-foreground">Sin presupuesto asignado</span>
                      }
                    </div>
                    {rubroItems.length > 0 && (
                      <div className="mt-1 pl-3 space-y-0.5">
                        {rubroItems.map((item) => (
                          <div key={item.id} className="flex items-start justify-between gap-2">
                            <span className="text-xs text-muted-foreground leading-snug">• {item.name}</span>
                            <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                              {formatCOP(parseFloat(item.unit_price))}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {total > 0 && (
              <div className="mt-2 pt-3 border-t border-border flex items-center justify-between">
                <span className="text-sm font-semibold">Total presupuesto</span>
                <span className="text-sm font-bold tabular-nums">{formatCOP(total)}</span>
              </div>
            )}
          </div>
        )
      })()}

      {/* Items editor */}
      <div className="section-card">
        <QuoteItemsEditor
          quoteId={quote.id}
          initialItems={items.map((i) => ({
            id:          i.id,
            name:        i.name,
            category:    i.category,
            unit:        i.unit,
            quantity:    i.quantity,
            unit_price:  i.unit_price,
            total_price: i.total_price,
          }))}
          discountPercentage={quote.discount_percentage}
          taxPercentage={quote.tax_percentage}
          advancePercentage={quote.advance_percentage}
          readonly={!isDraft}
        />
      </div>

      {/* Summary card: percentages + conditions */}
      <div className="section-card space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Condiciones</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Descuento", value: `${quote.discount_percentage}%` },
            { label: "IVA",       value: `${quote.tax_percentage}%` },
            { label: "Anticipo",  value: `${quote.advance_percentage}%` },
            { label: "Imprevistos", value: `${quote.contingency_percentage}%` },
          ].map((row) => (
            <div key={row.label} className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-[11px] text-muted-foreground">{row.label}</p>
              <p className="text-base font-bold tabular-nums mt-0.5">{row.value}</p>
            </div>
          ))}
        </div>

        {/* Advance amount highlight */}
        {parseFloat(quote.advance_amount) > 0 && (
          <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-foreground">Anticipo a pagar</span>
            <span className="text-base font-bold tabular-nums">{formatCOP(parseFloat(quote.advance_amount))}</span>
          </div>
        )}
      </div>

      {/* Timestamps */}
      <div className="text-xs text-muted-foreground space-y-0.5 pb-2">
        <p>Creada {new Date(quote.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}</p>
        {quote.sent_at && <p>Enviada {new Date(quote.sent_at).toLocaleDateString("es-CO", { day: "numeric", month: "long" })}</p>}
        {quote.decided_at && <p>Decidida {new Date(quote.decided_at).toLocaleDateString("es-CO", { day: "numeric", month: "long" })}</p>}
      </div>

      {/* Actions */}
      <QuoteActions quoteId={quote.id} status={quote.status as "draft" | "sent" | "approved" | "rejected" | "converted"} hasRubros={hasRubros} />
    </main>
  )
}
