import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { quotes } from "@/lib/db/schema"
import { requireRole } from "@/lib/auth"
import { and, eq, isNull } from "drizzle-orm"

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"])

    const [quote] = await db
      .select({ id: quotes.id, status: quotes.status })
      .from(quotes)
      .where(and(eq(quotes.id, params.id), isNull(quotes.deleted_at)))

    if (!quote) return NextResponse.json({ success: false, error: "Cotización no encontrada" }, { status: 404 })
    if (quote.status !== "draft") return NextResponse.json({ success: false, error: "Solo borradores pueden enviarse" }, { status: 409 })

    const [updated] = await db
      .update(quotes)
      .set({ status: "sent", sent_at: new Date() })
      .where(eq(quotes.id, params.id))
      .returning()

    return NextResponse.json({ success: true, data: updated })
  } catch {
    return NextResponse.json({ success: false, error: "Error al enviar cotización" }, { status: 500 })
  }
}
