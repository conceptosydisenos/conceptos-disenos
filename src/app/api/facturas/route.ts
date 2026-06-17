import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { invoices, invoice_allocations } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { desc, eq } from "drizzle-orm"

export async function GET(req: Request) {
  try {
    await requireAuth()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const rows = await db
      .select()
      .from(invoices)
      .where(
        status && status !== "all"
          ? eq(invoices.status, status as "pending_allocation" | "allocated" | "verified")
          : undefined
      )
      .orderBy(desc(invoices.created_at))
    return NextResponse.json({ success: true, data: rows })
  } catch {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
  }
}

const createSchema = z.object({
  invoice_number: z.string().min(1, "Número de factura requerido"),
  supplier_name: z.string().min(1, "Proveedor requerido"),
  supplier_nit: z.string().optional(),
  invoice_date: z.string().min(1, "Fecha requerida"),
  subtotal: z.coerce.number().min(0),
  tax_amount: z.coerce.number().min(0).default(0),
  total_amount: z.coerce.number().positive("El total debe ser mayor a 0"),
  image_url: z.string().url("URL de imagen inválida"),
  ocr_raw_data: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
  initial_project_id: z.string().uuid().optional(),
})

export async function POST(req: Request) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const data = createSchema.parse(body)

    const hasInitialProject = !!data.initial_project_id

    const [invoice] = await db
      .insert(invoices)
      .values({
        invoice_number: data.invoice_number,
        supplier_name: data.supplier_name,
        supplier_nit: data.supplier_nit || null,
        invoice_date: data.invoice_date,
        subtotal: String(data.subtotal),
        tax_amount: String(data.tax_amount),
        total_amount: String(data.total_amount),
        image_url: data.image_url,
        ocr_raw_data: data.ocr_raw_data ?? null,
        notes: data.notes || null,
        status: hasInitialProject ? "allocated" : "pending_allocation",
        created_by: user.id,
      })
      .returning({ id: invoices.id, total_amount: invoices.total_amount })

    if (hasInitialProject) {
      await db.insert(invoice_allocations).values({
        invoice_id: invoice.id,
        project_id: data.initial_project_id!,
        amount: String(data.total_amount),
        percentage: "100.00",
        category: "materiales",
        notes: null,
      })
    }

    return NextResponse.json({ success: true, data: invoice }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: "Error al guardar factura" }, { status: 500 })
  }
}
