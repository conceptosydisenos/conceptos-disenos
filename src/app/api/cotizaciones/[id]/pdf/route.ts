export const maxDuration = 30

import { NextResponse } from "next/server"
import { createElement, type ReactElement } from "react"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import { readFileSync } from "fs"
import { join } from "path"
import { db } from "@/lib/db"
import { quotes, quote_items, quote_rubros } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { and, asc, eq, isNull } from "drizzle-orm"
import { CotizacionPDF, type RubroPDFData } from "@/components/cotizaciones/CotizacionPDF"

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const [quote] = await db
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, params.id), isNull(quotes.deleted_at)))

    if (!quote) {
      return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 })
    }

    const [allRubros, allItems] = await Promise.all([
      db
        .select()
        .from(quote_rubros)
        .where(eq(quote_rubros.quote_id, params.id))
        .orderBy(asc(quote_rubros.sort_order)),
      db
        .select({ id: quote_items.id, name: quote_items.name, unit_price: quote_items.unit_price, quote_rubro_id: quote_items.quote_rubro_id })
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

    const rubros: RubroPDFData[] = allRubros.map((r) => ({
      id:            r.id,
      name:          r.name,
      budget_amount: r.budget_amount,
      active:        r.active,
      activities:    (itemsByRubroId.get(r.id) ?? []).map((i) => ({
        name:       i.name,
        unit_price: i.unit_price,
      })),
    }))

    // Read logo as base64 data URL
    const logoPath = join(process.cwd(), "public", "logo.jpg")
    const logoBase64 = readFileSync(logoPath).toString("base64")
    const logoSrc = `data:image/jpeg;base64,${logoBase64}`

    const pdfBuffer = await renderToBuffer(
      createElement(CotizacionPDF, { quote, rubros, logoSrc }) as ReactElement<DocumentProps>
    )

    const filename = `cotizacion-${quote.quote_number.replace(/\//g, "-")}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    console.error("PDF generation error:", err)
    return NextResponse.json({ error: "Error al generar PDF" }, { status: 500 })
  }
}
