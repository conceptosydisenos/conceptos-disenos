import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { invoices, invoice_allocations, projects } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { eq } from "drizzle-orm"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAuth()

    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, params.id))

    if (!invoice) {
      return NextResponse.json({ success: false, error: "Factura no encontrada" }, { status: 404 })
    }

    const allocations = await db
      .select({
        id: invoice_allocations.id,
        project_id: invoice_allocations.project_id,
        amount: invoice_allocations.amount,
        percentage: invoice_allocations.percentage,
        category: invoice_allocations.category,
        notes: invoice_allocations.notes,
        project_name: projects.name,
      })
      .from(invoice_allocations)
      .leftJoin(projects, eq(invoice_allocations.project_id, projects.id))
      .where(eq(invoice_allocations.invoice_id, params.id))

    return NextResponse.json({ success: true, data: { ...invoice, allocations } })
  } catch {
    return NextResponse.json({ success: false, error: "Error al cargar factura" }, { status: 500 })
  }
}
