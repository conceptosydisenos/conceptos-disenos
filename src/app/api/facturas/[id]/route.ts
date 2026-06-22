import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { invoices, invoice_allocations, projects } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { eq } from "drizzle-orm"
import { z } from "zod"

const patchSchema = z.object({
  invoice_number: z.string().min(1).optional(),
  supplier_name: z.string().min(1).optional(),
  supplier_nit: z.string().optional(),
  invoice_date: z.string().min(1).optional(),
  subtotal: z.coerce.number().min(0).optional(),
  tax_amount: z.coerce.number().min(0).optional(),
  total_amount: z.coerce.number().positive().optional(),
  notes: z.string().optional(),
})

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

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAuth()

    const body: unknown = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Datos inválidos" }, { status: 400 })
    }

    const [existing] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.id, params.id))

    if (!existing) {
      return NextResponse.json({ success: false, error: "Factura no encontrada" }, { status: 404 })
    }

    const { subtotal, tax_amount, total_amount, ...rest } = parsed.data

    const [updated] = await db
      .update(invoices)
      .set({
        ...rest,
        ...(subtotal !== undefined && { subtotal: String(subtotal) }),
        ...(tax_amount !== undefined && { tax_amount: String(tax_amount) }),
        ...(total_amount !== undefined && { total_amount: String(total_amount) }),
      })
      .where(eq(invoices.id, params.id))
      .returning()

    return NextResponse.json({ success: true, data: updated })
  } catch {
    return NextResponse.json({ success: false, error: "Error al actualizar factura" }, { status: 500 })
  }
}
