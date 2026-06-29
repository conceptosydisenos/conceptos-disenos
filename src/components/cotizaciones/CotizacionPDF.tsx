import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer"

const NAVY  = "#1C2333"
const GREEN = "#2D9B6F"
const GRAY  = "#6B7280"
const LIGHT = "#F3F4F6"
const BORDER = "#E5E7EB"
const WHITE = "#FFFFFF"

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

const s = StyleSheet.create({
  page: {
    fontSize: 9,
    color: "#111827",
    backgroundColor: WHITE,
    paddingTop: 38,
    paddingBottom: 56,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
  },
  // ── Header ──────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 22,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
    borderBottomStyle: "solid",
  },
  headerLeft: { flexDirection: "row", alignItems: "flex-start" },
  logo: { width: 44, height: 44, objectFit: "contain", marginRight: 10 },
  companyName: { fontSize: 12, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 3 },
  companySub: { fontSize: 8, color: GRAY },
  headerRight: { alignItems: "flex-end" },
  quoteNumber: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 4 },
  dateRow: { fontSize: 8, color: GRAY, marginBottom: 2 },
  // ── Section ─────────────────────────────────────────────────
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: WHITE,
    backgroundColor: NAVY,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 8,
    letterSpacing: 0.6,
  },
  // ── Data grid ───────────────────────────────────────────────
  twoCol: { flexDirection: "row", marginBottom: 6 },
  col: { flex: 1 },
  colRight: { flex: 1, marginLeft: 12 },
  fieldLabel: { fontSize: 7, color: GRAY, marginBottom: 1 },
  fieldValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  projectName: { fontSize: 10, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 10 },
  // ── Rubros ──────────────────────────────────────────────────
  rubroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 6,
    backgroundColor: LIGHT,
    marginBottom: 1,
  },
  rubroName: { fontSize: 9, fontFamily: "Helvetica-Bold", flex: 1, marginRight: 8 },
  rubroAmount: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  activityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
    paddingLeft: 18,
    paddingRight: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    borderBottomStyle: "solid",
    marginBottom: 1,
  },
  activityBullet: { fontSize: 8, color: GRAY, marginRight: 4 },
  activityDesc: { fontSize: 8, color: GRAY, flex: 1, marginRight: 8 },
  activityAmount: { fontSize: 8, color: GRAY },
  // ── Conditions ──────────────────────────────────────────────
  condRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    borderBottomStyle: "solid",
    marginBottom: 1,
  },
  condLabel: { fontSize: 8, color: GRAY },
  condValue: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  // ── Totals ──────────────────────────────────────────────────
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 3,
    backgroundColor: LIGHT,
  },
  totalRowGreen: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 3,
    backgroundColor: GREEN,
  },
  totalLabel: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  totalValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  totalLabelW: { fontSize: 9, fontFamily: "Helvetica-Bold", color: WHITE },
  totalValueW: { fontSize: 10, fontFamily: "Helvetica-Bold", color: WHITE },
  // ── Footer ──────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 22,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    borderTopStyle: "solid",
  },
  footerText: { fontSize: 7, color: GRAY },
})

export interface QuotePDFData {
  quote_number: string
  project_name: string
  contact_name:  string | null
  contact_phone: string | null
  contact_email: string | null
  valid_until:   string
  created_at:    Date | string
  discount_percentage:    string
  tax_percentage:         string
  advance_percentage:     string
  advance_amount:         string
  total_amount:           string
  subtotal_amount:        string
}

export interface RubroPDFData {
  id:            string
  name:          string
  budget_amount: string
  active:        boolean
  activities:    { name: string; unit_price: string }[]
}

interface Props {
  quote:    QuotePDFData
  rubros:   RubroPDFData[]
  logoSrc:  string
}

export function CotizacionPDF({ quote, rubros, logoSrc }: Props) {
  const total     = parseFloat(quote.total_amount)
  const subtotal  = parseFloat(quote.subtotal_amount)
  const advance   = parseFloat(quote.advance_amount)
  const remaining = total - advance
  const discPct   = parseFloat(quote.discount_percentage)
  const taxPct    = parseFloat(quote.tax_percentage)
  const advPct    = parseFloat(quote.advance_percentage)

  const activeRubros = rubros.filter((r) => r.active)

  return (
    <Document
      title={`Cotización ${quote.quote_number}`}
      author="Conceptos y Diseños Arquitectura"
    >
      <Page size="LETTER" style={s.page}>
        {/* ── Header ─────────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Image src={logoSrc} style={s.logo} />
            <View>
              <Text style={s.companyName}>Conceptos y Diseños Arquitectura</Text>
              <Text style={s.companySub}>Medellín, Colombia</Text>
            </View>
          </View>
          <View style={s.headerRight}>
            <Text style={s.quoteNumber}>{quote.quote_number}</Text>
            <Text style={s.dateRow}>Fecha: {fmtDate(quote.created_at)}</Text>
            <Text style={s.dateRow}>Válida hasta: {fmtDate(quote.valid_until)}</Text>
          </View>
        </View>

        {/* ── Cliente ─────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>DATOS DEL CLIENTE</Text>
          <Text style={s.projectName}>{quote.project_name}</Text>
          <View style={s.twoCol}>
            <View style={s.col}>
              {quote.contact_name && (
                <View style={{ marginBottom: 6 }}>
                  <Text style={s.fieldLabel}>Cliente</Text>
                  <Text style={s.fieldValue}>{quote.contact_name}</Text>
                </View>
              )}
              {quote.contact_phone && (
                <View>
                  <Text style={s.fieldLabel}>Teléfono</Text>
                  <Text style={s.fieldValue}>{quote.contact_phone}</Text>
                </View>
              )}
            </View>
            <View style={s.colRight}>
              {quote.contact_email && (
                <View>
                  <Text style={s.fieldLabel}>Email</Text>
                  <Text style={s.fieldValue}>{quote.contact_email}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── Rubros y actividades ─────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>RUBROS Y PRESUPUESTO</Text>
          {activeRubros.map((rubro) => {
            const amount = parseFloat(rubro.budget_amount)
            return (
              <View key={rubro.id}>
                <View style={s.rubroRow}>
                  <Text style={s.rubroName}>{rubro.name}</Text>
                  <Text style={s.rubroAmount}>
                    {amount > 0 ? fmt(amount) : "Sin asignar"}
                  </Text>
                </View>
                {rubro.activities.map((act, i) => (
                  <View key={i} style={s.activityRow}>
                    <Text style={s.activityBullet}>•</Text>
                    <Text style={s.activityDesc}>{act.name}</Text>
                    <Text style={s.activityAmount}>{fmt(parseFloat(act.unit_price))}</Text>
                  </View>
                ))}
              </View>
            )
          })}
        </View>

        {/* ── Condiciones ──────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>CONDICIONES</Text>
          <View style={s.condRow}>
            <Text style={s.condLabel}>Validez</Text>
            <Text style={s.condValue}>{fmtDate(quote.valid_until)}</Text>
          </View>
          <View style={s.condRow}>
            <Text style={s.condLabel}>Anticipo requerido</Text>
            <Text style={s.condValue}>{advPct}% → {fmt(advance)}</Text>
          </View>
          {discPct > 0 && (
            <View style={s.condRow}>
              <Text style={s.condLabel}>Descuento</Text>
              <Text style={s.condValue}>{discPct}%</Text>
            </View>
          )}
          {taxPct > 0 && (
            <View style={s.condRow}>
              <Text style={s.condLabel}>IVA</Text>
              <Text style={s.condValue}>{taxPct}%</Text>
            </View>
          )}
        </View>

        {/* ── Totales ──────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>TOTALES</Text>
          {subtotal !== total && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Subtotal</Text>
              <Text style={s.totalValue}>{fmt(subtotal)}</Text>
            </View>
          )}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total presupuestado</Text>
            <Text style={s.totalValue}>{fmt(total)}</Text>
          </View>
          <View style={s.totalRowGreen}>
            <Text style={s.totalLabelW}>Anticipo a pagar ({advPct}%)</Text>
            <Text style={s.totalValueW}>{fmt(advance)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Valor restante</Text>
            <Text style={s.totalValue}>{fmt(remaining)}</Text>
          </View>
        </View>

        {/* ── Footer ───────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Medellín, Colombia · conceptosydisenos.vercel.app</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) =>
            `Página ${pageNumber} de ${totalPages}`
          } />
        </View>
      </Page>
    </Document>
  )
}
