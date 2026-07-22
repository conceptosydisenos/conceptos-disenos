import { db } from "@/lib/db"
import { quotes, quote_items, quote_rubros } from "@/lib/db/schema"
import { requireRole } from "@/lib/auth"
import { and, asc, eq, isNull } from "drizzle-orm"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { QuoteForm } from "@/components/cotizaciones/QuoteForm"
import type { RubroRow } from "@/components/cotizaciones/QuoteRubrosEditor"

interface Props {
  params: { id: string }
}

export default async function EditarCotizacionPage({ params }: Props) {
  await requireRole(["admin"])

  const [quote] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, params.id), isNull(quotes.deleted_at)))

  if (!quote) notFound()
  if (quote.status !== "draft") redirect(`/dashboard/cotizaciones/${params.id}`)

  const [allRubros, allItems] = await Promise.all([
    db
      .select()
      .from(quote_rubros)
      .where(eq(quote_rubros.quote_id, params.id))
      .orderBy(asc(quote_rubros.sort_order)),
    db
      .select()
      .from(quote_items)
      .where(eq(quote_items.quote_id, params.id))
      .orderBy(asc(quote_items.sort_order), asc(quote_items.created_at)),
  ])

  // Group activity items by rubro ID
  const itemsByRubroId = new Map<string, typeof allItems>()
  for (const item of allItems) {
    if (item.quote_rubro_id) {
      const existing = itemsByRubroId.get(item.quote_rubro_id) ?? []
      existing.push(item)
      itemsByRubroId.set(item.quote_rubro_id, existing)
    }
  }

  const existingActivityItemIds = allItems
    .filter((i) => i.quote_rubro_id !== null)
    .map((i) => i.id)

  const initialRubros: RubroRow[] = allRubros.map((r) => ({
    rubro_type:    r.rubro_type,
    name:          r.name,
    budget_amount: parseFloat(r.budget_amount),
    active:        r.active,
    sort_order:    r.sort_order,
    activities:    (itemsByRubroId.get(r.id) ?? []).map((i) => ({
      description: i.name,
      quantity:    parseFloat(i.quantity),
      unit_price:  parseFloat(i.unit_price),
      amount:      parseFloat(i.total_price),
    })),
    autoCalculate: false,
  }))

  return (
    <main className="px-4 pt-6 pb-24 md:px-8 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard/cotizaciones/${params.id}`}
          className="p-1.5 -ml-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <p className="text-xs font-mono text-muted-foreground">{quote.quote_number}</p>
          <h1 className="text-xl font-bold text-foreground leading-tight">Editar cotización</h1>
        </div>
      </div>

      <div className="section-card">
        <QuoteForm
          quoteId={params.id}
          existingActivityItemIds={existingActivityItemIds}
          initialValues={{
            project_name:           quote.project_name,
            description:            quote.description ?? undefined,
            contact_name:           quote.contact_name ?? undefined,
            contact_phone:          quote.contact_phone ?? undefined,
            contact_email:          quote.contact_email ?? undefined,
            valid_until:            quote.valid_until,
            discount_percentage:    parseFloat(quote.discount_percentage),
            tax_percentage:         parseFloat(quote.tax_percentage),
            advance_percentage:     parseFloat(quote.advance_percentage),
            contingency_percentage: parseFloat(quote.contingency_percentage),
            rubros:                 initialRubros,
          }}
        />
      </div>
    </main>
  )
}
