import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { contractor_payments, audit_logs } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { eq } from "drizzle-orm"

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth()

    const [payment] = await db
      .select({ id: contractor_payments.id, status: contractor_payments.status })
      .from(contractor_payments)
      .where(eq(contractor_payments.id, params.id))

    if (!payment) {
      return NextResponse.json({ success: false, error: "Pago no encontrado" }, { status: 404 })
    }

    if (payment.status === "paid") {
      return NextResponse.json({ success: false, error: "Este pago ya fue marcado como pagado." }, { status: 409 })
    }

    await db
      .update(contractor_payments)
      .set({ status: "paid" })
      .where(eq(contractor_payments.id, params.id))

    await db.insert(audit_logs).values({
      user_id: user.id,
      action: "update",
      entity_type: "contractor_payment",
      entity_id: params.id,
      old_values: { status: "pending" },
      new_values: { status: "paid" },
    })

    return NextResponse.json({ success: true, data: { id: params.id, status: "paid" } })
  } catch {
    return NextResponse.json({ success: false, error: "Error al marcar como pagado" }, { status: 500 })
  }
}
