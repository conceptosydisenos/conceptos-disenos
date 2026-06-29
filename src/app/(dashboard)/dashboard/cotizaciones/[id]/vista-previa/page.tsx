import { db } from "@/lib/db"
import { quotes, quote_items, quote_rubros, clients } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { and, asc, eq, isNull } from "drizzle-orm"
import { notFound } from "next/navigation"
import { PrintButton } from "./PrintButton"

const fmt = (n: number | string) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(n))

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

interface Props {
  params: { id: string }
}

export default async function VistaPrevia({ params }: Props) {
  await requireAuth()

  const [quote] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, params.id), isNull(quotes.deleted_at)))

  if (!quote) notFound()

  const [clientRow] = quote.client_id
    ? await db.select({ name: clients.name }).from(clients).where(eq(clients.id, quote.client_id))
    : []

  const rubros = await db
    .select()
    .from(quote_rubros)
    .where(eq(quote_rubros.quote_id, params.id))
    .orderBy(asc(quote_rubros.sort_order))

  const items = await db
    .select()
    .from(quote_items)
    .where(eq(quote_items.quote_id, params.id))
    .orderBy(asc(quote_items.sort_order), asc(quote_items.created_at))

  const itemsByRubroId = new Map<string, typeof items>()
  for (const item of items) {
    if (item.quote_rubro_id) {
      const arr = itemsByRubroId.get(item.quote_rubro_id) ?? []
      arr.push(item)
      itemsByRubroId.set(item.quote_rubro_id, arr)
    }
  }

  const subtotal = parseFloat(quote.subtotal_amount)
  const discount = parseFloat(quote.discount_amount)
  const tax = parseFloat(quote.tax_amount)
  const total = parseFloat(quote.total_amount)
  const advance = parseFloat(quote.advance_amount)
  const remaining = total - advance

  const contactName = clientRow?.name ?? quote.contact_name

  const NAVY = "#1C2333"
  const GREEN = "#2D9B6F"

  return (
    <>
      {/* Print CSS — hides sidebar, nav, print button */}
      <style>{`
        @media print {
          aside, nav, .no-print { display: none !important; }
          body { background: white !important; }
          .print-page { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <PrintButton />
      </div>

      <div
        className="print-page bg-white max-w-3xl mx-auto my-8 p-10 shadow-lg rounded-lg"
        style={{ fontFamily: "Georgia, serif", fontSize: "13px", lineHeight: "1.6", color: "#111827" }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `2px solid ${NAVY}`, paddingBottom: "16px", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="Logo" style={{ width: "48px", height: "48px", objectFit: "contain" }} />
            <div>
              <div style={{ fontSize: "15px", fontWeight: "700", color: NAVY }}>Conceptos y Diseños</div>
              <div style={{ fontSize: "11px", color: "#6B7280" }}>Arquitectura & Remodelación</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "20px", fontWeight: "700", color: NAVY, letterSpacing: "0.05em" }}>COTIZACIÓN</div>
            <div style={{ fontSize: "13px", fontWeight: "600", color: GREEN, marginTop: "4px" }}>{quote.quote_number}</div>
            <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "4px" }}>
              Creada {fmtDate(quote.created_at)}
            </div>
            <div style={{ fontSize: "11px", color: "#6B7280" }}>
              Válida hasta {fmtDate(quote.valid_until)}
            </div>
          </div>
        </div>

        {/* Project name */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "17px", fontWeight: "700", color: NAVY }}>{quote.project_name}</div>
        </div>

        {/* Client info */}
        {(contactName || quote.contact_email || quote.contact_phone) && (
          <div style={{ marginBottom: "24px", padding: "14px", backgroundColor: "#F9FAFB", borderRadius: "8px", border: "1px solid #E5E7EB" }}>
            <div style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280", marginBottom: "10px" }}>
              Información del cliente
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {contactName && (
                <div>
                  <div style={{ fontSize: "10px", color: "#9CA3AF" }}>Nombre</div>
                  <div style={{ fontWeight: "600" }}>{contactName}</div>
                </div>
              )}
              {quote.contact_phone && (
                <div>
                  <div style={{ fontSize: "10px", color: "#9CA3AF" }}>Teléfono</div>
                  <div style={{ fontWeight: "600" }}>{quote.contact_phone}</div>
                </div>
              )}
              {quote.contact_email && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: "10px", color: "#9CA3AF" }}>Email</div>
                  <div style={{ fontWeight: "600" }}>{quote.contact_email}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Description */}
        {quote.description && (
          <div style={{ marginBottom: "20px", padding: "12px 14px", borderLeft: `3px solid ${GREEN}`, backgroundColor: "#F0FDF9" }}>
            <div style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280", marginBottom: "6px" }}>
              Descripción
            </div>
            <p style={{ margin: 0, color: "#374151" }}>{quote.description}</p>
          </div>
        )}

        {/* Rubros */}
        {rubros.length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <div style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280", marginBottom: "12px" }}>
              Rubros y actividades
            </div>
            {rubros.filter(r => r.active).map((rubro) => {
              const rubroItems = itemsByRubroId.get(rubro.id) ?? []
              const amount = parseFloat(rubro.budget_amount)
              return (
                <div key={rubro.id} style={{ marginBottom: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: NAVY, color: "white", padding: "8px 12px", borderRadius: "6px 6px 0 0", fontWeight: "700", fontSize: "12px" }}>
                    <span>{rubro.name}</span>
                    {amount > 0 && <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(amount)}</span>}
                  </div>
                  {rubroItems.length > 0 && (
                    <div style={{ border: "1px solid #E5E7EB", borderTop: "none", borderRadius: "0 0 6px 6px", overflow: "hidden" }}>
                      {rubroItems.map((item, i) => (
                        <div
                          key={item.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "7px 12px",
                            backgroundColor: i % 2 === 0 ? "#FAFAFA" : "white",
                            fontSize: "12px",
                          }}
                        >
                          <span style={{ color: "#374151" }}>• {item.name}</span>
                          <span style={{ fontVariantNumeric: "tabular-nums", color: "#6B7280" }}>{fmt(item.unit_price)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {rubroItems.length === 0 && amount === 0 && (
                    <div style={{ padding: "8px 12px", border: "1px solid #E5E7EB", borderTop: "none", borderRadius: "0 0 6px 6px", color: "#9CA3AF", fontSize: "11px" }}>
                      Sin actividades
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Totals */}
        <div style={{ marginBottom: "24px", borderTop: `2px solid ${NAVY}`, paddingTop: "16px" }}>
          <div style={{ maxWidth: "300px", marginLeft: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "12px", borderBottom: "1px solid #E5E7EB" }}>
              <span style={{ color: "#6B7280" }}>Subtotal</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "12px", borderBottom: "1px solid #E5E7EB" }}>
                <span style={{ color: "#6B7280" }}>Descuento ({quote.discount_percentage}%)</span>
                <span style={{ fontVariantNumeric: "tabular-nums", color: "#DC2626" }}>-{fmt(discount)}</span>
              </div>
            )}
            {tax > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "12px", borderBottom: "1px solid #E5E7EB" }}>
                <span style={{ color: "#6B7280" }}>IVA ({quote.tax_percentage}%)</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(tax)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontWeight: "700", fontSize: "15px", borderTop: `2px solid ${NAVY}`, marginTop: "4px", color: NAVY }}>
              <span>Total</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(total)}</span>
            </div>
          </div>
        </div>

        {/* Conditions */}
        <div style={{ marginBottom: "24px", padding: "14px", backgroundColor: "#F0FDF9", borderRadius: "8px", border: `1px solid ${GREEN}30` }}>
          <div style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280", marginBottom: "12px" }}>
            Condiciones de pago
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div style={{ padding: "10px", backgroundColor: "white", borderRadius: "6px", border: "1px solid #E5E7EB", textAlign: "center" }}>
              <div style={{ fontSize: "10px", color: "#9CA3AF" }}>Anticipo</div>
              <div style={{ fontSize: "16px", fontWeight: "700", color: NAVY }}>{quote.advance_percentage}%</div>
              <div style={{ fontSize: "11px", fontWeight: "600", color: GREEN, fontVariantNumeric: "tabular-nums" }}>{fmt(advance)}</div>
            </div>
            <div style={{ padding: "10px", backgroundColor: "white", borderRadius: "6px", border: "1px solid #E5E7EB", textAlign: "center" }}>
              <div style={{ fontSize: "10px", color: "#9CA3AF" }}>Saldo al terminar</div>
              <div style={{ fontSize: "16px", fontWeight: "700", color: NAVY }}>{(100 - parseFloat(quote.advance_percentage)).toFixed(0)}%</div>
              <div style={{ fontSize: "11px", fontWeight: "600", color: "#374151", fontVariantNumeric: "tabular-nums" }}>{fmt(remaining)}</div>
            </div>
          </div>
          {parseFloat(quote.contingency_percentage) > 0 && (
            <div style={{ marginTop: "10px", fontSize: "11px", color: "#6B7280" }}>
              * Incluye {quote.contingency_percentage}% de imprevistos sobre el valor cotizado.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "10px", color: "#9CA3AF" }}>
            Esta cotización es válida hasta el {fmtDate(quote.valid_until)}.
          </div>
          <div style={{ fontSize: "10px", color: "#9CA3AF" }}>
            {quote.quote_number}
          </div>
        </div>
      </div>
    </>
  )
}
