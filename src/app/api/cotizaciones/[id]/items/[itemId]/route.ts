import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { quotes, quote_items } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { and, eq, isNull } from "drizzle-orm"
import { calculateQuoteTotals } from "@/lib/calculations"

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const user = await requireAuth()

    const ownerFilter = user.role === "admin"
      ? and(eq(quotes.id, params.id), isNull(quotes.deleted_at))
      : and(eq(quotes.id, params.id), eq(quotes.created_by, user.id), isNull(quotes.deleted_at))

    const [quote] = await db
      .select()
      .from(quotes)
      .where(ownerFilter)

    if (!quote) return NextResponse.json({ success: false, error: "Cotización no encontrada" }, { status: 404 })
    if (quote.status !== "draft") return NextResponse.json({ success: false, error: "Solo se pueden editar cotizaciones en borrador" }, { status: 409 })

    await db
      .delete(quote_items)
      .where(and(eq(quote_items.id, params.itemId), eq(quote_items.quote_id, params.id)))

    // Recalculate totals after deletion
    const remaining = await db
      .select({ total_price: quote_items.total_price })
      .from(quote_items)
      .where(eq(quote_items.quote_id, params.id))

    const totals = calculateQuoteTotals(
      remaining,
      parseFloat(quote.discount_percentage),
      parseFloat(quote.tax_percentage),
      parseFloat(quote.advance_percentage)
    )

    await db
      .update(quotes)
      .set({
        subtotal_amount: String(totals.subtotal_amount),
        discount_amount: String(totals.discount_amount),
        tax_amount:      String(totals.tax_amount),
        total_amount:    String(totals.total_amount),
        advance_amount:  String(totals.advance_amount),
      })
      .where(eq(quotes.id, params.id))

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: "Error al eliminar ítem" }, { status: 500 })
  }
}
