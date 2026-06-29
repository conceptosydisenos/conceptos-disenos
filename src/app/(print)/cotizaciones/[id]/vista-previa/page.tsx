import { db } from "@/lib/db"
import { quotes, quote_items, quote_rubros, clients } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { and, asc, eq, isNull } from "drizzle-orm"
import { notFound } from "next/navigation"
import { PrintButton } from "./PrintButton"
import "./vista-previa.css"

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

const NAVY  = "#1C2333"
const GREEN = "#2D9B6F"

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

  const subtotal  = parseFloat(quote.subtotal_amount)
  const discount  = parseFloat(quote.discount_amount)
  const tax       = parseFloat(quote.tax_amount)
  const total     = parseFloat(quote.total_amount)
  const advance   = parseFloat(quote.advance_amount)
  const remaining = total - advance
  const contactName = clientRow?.name ?? quote.contact_name

  const activeRubros = rubros.filter(r => r.active)

  return (
    <div className="vp-wrap">
      <div className="vp-card">

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `2.5px solid ${NAVY}`, paddingBottom: "18px", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="Logo" width={52} height={52} style={{ objectFit: "contain" }} />
            <div>
              <div style={{ fontSize: "16px", fontWeight: "700", color: NAVY }}>Conceptos y Diseños</div>
              <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "2px" }}>Arquitectura &amp; Remodelación</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "22px", fontWeight: "700", color: NAVY, letterSpacing: "0.06em" }}>COTIZACIÓN</div>
            <div style={{ fontSize: "13px", fontWeight: "700", color: GREEN, marginTop: "4px" }}>{quote.quote_number}</div>
            <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "4px" }}>Creada {fmtDate(quote.created_at)}</div>
            <div style={{ fontSize: "11px", color: "#6B7280" }}>Válida hasta {fmtDate(quote.valid_until)}</div>
          </div>
        </div>

        {/* Project */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "18px", fontWeight: "700", color: NAVY }}>{quote.project_name}</div>
          {quote.description && (
            <div style={{ fontSize: "12px", color: "#6B7280", marginTop: "6px", lineHeight: "1.5" }}>{quote.description}</div>
          )}
        </div>

        {/* Client */}
        {(contactName || quote.contact_email || quote.contact_phone) && (
          <div style={{ marginBottom: "24px", padding: "14px 16px", backgroundColor: "#F9FAFB", borderRadius: "8px", border: "1px solid #E5E7EB" }}>
            <div style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280", marginBottom: "10px" }}>
              Información del cliente
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px" }}>
              {contactName && (
                <div>
                  <div style={{ color: "#9CA3AF", fontSize: "10px" }}>Nombre</div>
                  <div style={{ fontWeight: "600", color: "#111827" }}>{contactName}</div>
                </div>
              )}
              {quote.contact_phone && (
                <div>
                  <div style={{ color: "#9CA3AF", fontSize: "10px" }}>Teléfono</div>
                  <div style={{ fontWeight: "600", color: "#111827" }}>{quote.contact_phone}</div>
                </div>
              )}
              {quote.contact_email && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ color: "#9CA3AF", fontSize: "10px" }}>Email</div>
                  <div style={{ fontWeight: "600", color: "#111827" }}>{quote.contact_email}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rubros */}
        {activeRubros.length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <div style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280", marginBottom: "12px" }}>
              Rubros y actividades
            </div>
            {activeRubros.map((rubro) => {
              const rubroItems = itemsByRubroId.get(rubro.id) ?? []
              const amount = parseFloat(rubro.budget_amount)
              return (
                <div key={rubro.id} style={{ marginBottom: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: NAVY, color: "white", padding: "9px 14px", borderRadius: rubroItems.length > 0 ? "7px 7px 0 0" : "7px", fontSize: "12px", fontWeight: "700" }}>
                    <span>{rubro.name}</span>
                    {amount > 0 && <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(amount)}</span>}
                  </div>
                  {rubroItems.length > 0 && (
                    <div style={{ border: "1px solid #E5E7EB", borderTop: "none", borderRadius: "0 0 7px 7px", overflow: "hidden" }}>
                      {rubroItems.map((item, i) => (
                        <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 14px", fontSize: "12px", backgroundColor: i % 2 === 0 ? "#FAFAFA" : "white" }}>
                          <span style={{ color: "#374151" }}>• {item.name}</span>
                          <span style={{ color: "#6B7280", fontVariantNumeric: "tabular-nums" }}>{fmt(item.unit_price)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Totals */}
        <div style={{ borderTop: `2.5px solid ${NAVY}`, paddingTop: "16px", marginBottom: "20px" }}>
          <div style={{ maxWidth: "280px", marginLeft: "auto" }}>
            {discount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "12px", borderBottom: "1px solid #F3F4F6" }}>
                <span style={{ color: "#6B7280" }}>Subtotal</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(subtotal)}</span>
              </div>
            )}
            {discount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "12px", borderBottom: "1px solid #F3F4F6", color: "#DC2626" }}>
                <span style={{ color: "#6B7280" }}>Descuento ({quote.discount_percentage}%)</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>−{fmt(discount)}</span>
              </div>
            )}
            {tax > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "12px", borderBottom: "1px solid #F3F4F6" }}>
                <span style={{ color: "#6B7280" }}>IVA ({quote.tax_percentage}%)</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(tax)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 4px", fontSize: "16px", fontWeight: "700", color: NAVY }}>
              <span>Total</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(total)}</span>
            </div>
          </div>
        </div>

        {/* Payment conditions */}
        <div style={{ padding: "16px", backgroundColor: "#F0FDF9", borderRadius: "8px", border: `1px solid ${GREEN}40`, marginBottom: "20px" }}>
          <div style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280", marginBottom: "12px" }}>
            Condiciones de pago
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div style={{ padding: "12px", backgroundColor: "white", borderRadius: "6px", border: "1px solid #E5E7EB", textAlign: "center" }}>
              <div style={{ fontSize: "10px", color: "#9CA3AF" }}>Anticipo</div>
              <div style={{ fontSize: "18px", fontWeight: "700", color: NAVY }}>{quote.advance_percentage}%</div>
              <div style={{ fontSize: "12px", fontWeight: "600", color: GREEN, fontVariantNumeric: "tabular-nums" }}>{fmt(advance)}</div>
            </div>
            <div style={{ padding: "12px", backgroundColor: "white", borderRadius: "6px", border: "1px solid #E5E7EB", textAlign: "center" }}>
              <div style={{ fontSize: "10px", color: "#9CA3AF" }}>Saldo al finalizar</div>
              <div style={{ fontSize: "18px", fontWeight: "700", color: NAVY }}>{(100 - parseFloat(quote.advance_percentage)).toFixed(0)}%</div>
              <div style={{ fontSize: "12px", fontWeight: "600", color: GREEN, fontVariantNumeric: "tabular-nums" }}>{fmt(remaining)}</div>
            </div>
          </div>
          {parseFloat(quote.contingency_percentage) > 0 && (
            <div style={{ marginTop: "10px", fontSize: "11px", color: "#6B7280" }}>
              * Incluye {quote.contingency_percentage}% de imprevistos.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #E5E7EB", paddingTop: "12px", fontSize: "10px", color: "#9CA3AF" }}>
          <span>Válida hasta el {fmtDate(quote.valid_until)}</span>
          <span>{quote.quote_number}</span>
        </div>

      </div>

      <PrintButton />
    </div>
  )
}
