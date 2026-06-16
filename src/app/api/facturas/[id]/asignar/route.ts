import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { invoices, invoice_allocations, audit_logs } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { eq } from "drizzle-orm"
import { validateAllocationTotal } from "@/lib/calculations"

const allocationSchema = z.object({
  allocations: z
    .array(
      z.object({
        project_id: z.string().uuid("ID de proyecto inválido"),
        amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
        percentage: z.coerce.number().min(0).max(100),
        category: z.enum(["materiales", "equipos", "otro"]).default("materiales"),
        notes: z.string().optional(),
      })
    )
    .min(1, "Debes asignar al menos un proyecto"),
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const { allocations } = allocationSchema.parse(body)

    const [invoice] = await db
      .select({ id: invoices.id, total_amount: invoices.total_amount, status: invoices.status })
      .from(invoices)
      .where(eq(invoices.id, params.id))

    if (!invoice) {
      return NextResponse.json({ success: false, error: "Factura no encontrada" }, { status: 404 })
    }

    if (invoice.status !== "pending_allocation") {
      return NextResponse.json(
        { success: false, error: "Esta factura ya fue asignada" },
        { status: 409 }
      )
    }

    const invoiceTotal = parseFloat(invoice.total_amount)
    const validation = validateAllocationTotal(allocations, invoiceTotal)

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.isOver
            ? `El total asignado ($${validation.allocated.toLocaleString("es-CO")}) supera el valor de la factura`
            : `Faltan $${Math.abs(validation.remaining).toLocaleString("es-CO")} por asignar (${((Math.abs(validation.remaining) / invoiceTotal) * 100).toFixed(1)}%)`,
        },
        { status: 400 }
      )
    }

    // Insert allocations
    await db.insert(invoice_allocations).values(
      allocations.map((a) => ({
        invoice_id: params.id,
        project_id: a.project_id,
        amount: String(a.amount),
        percentage: String(a.percentage),
        category: a.category,
        notes: a.notes || null,
      }))
    )

    // Update invoice status
    await db
      .update(invoices)
      .set({ status: "allocated", updated_at: new Date() })
      .where(eq(invoices.id, params.id))

    // Audit log
    await db.insert(audit_logs).values({
      user_id: user.id,
      action: "update",
      entity_type: "invoice",
      entity_id: params.id,
      new_values: { status: "allocated", allocations: allocations.length },
    })

    return NextResponse.json({ success: true, data: { id: params.id, status: "allocated" } })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: "Error al asignar factura" }, { status: 500 })
  }
}
