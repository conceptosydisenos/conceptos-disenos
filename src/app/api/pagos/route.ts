import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { contractor_payments, contractors, projects } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { and, desc, eq } from "drizzle-orm"

export async function GET(req: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(req.url)
    const contractor_id = searchParams.get("contratista_id")
    const project_id = searchParams.get("proyecto_id")

    const conditions = []
    if (contractor_id) conditions.push(eq(contractor_payments.contractor_id, contractor_id))
    if (project_id) conditions.push(eq(contractor_payments.project_id, project_id))

    const rows = await db
      .select({
        id: contractor_payments.id,
        amount: contractor_payments.amount,
        payment_date: contractor_payments.payment_date,
        payment_method: contractor_payments.payment_method,
        reference_number: contractor_payments.reference_number,
        status: contractor_payments.status,
        notes: contractor_payments.notes,
        contractor_id: contractor_payments.contractor_id,
        project_id: contractor_payments.project_id,
        contractor_name: contractors.name,
        project_name: projects.name,
      })
      .from(contractor_payments)
      .leftJoin(contractors, eq(contractor_payments.contractor_id, contractors.id))
      .leftJoin(projects, eq(contractor_payments.project_id, projects.id))
      .where(conditions.length > 0 ? and(...(conditions as [typeof conditions[0], ...typeof conditions])) : undefined)
      .orderBy(desc(contractor_payments.payment_date))
      .limit(100)

    return NextResponse.json({ success: true, data: rows })
  } catch {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
  }
}

const createSchema = z.object({
  contractor_id: z.string().uuid(),
  project_id: z.string().uuid(),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  payment_date: z.string().min(1, "Fecha requerida"),
  payment_method: z.enum(["transferencia", "efectivo", "cheque"], {
    errorMap: () => ({ message: "Método de pago inválido" }),
  }),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
  already_paid: z.boolean().default(false),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const data = createSchema.parse(body)

    const [payment] = await db
      .insert(contractor_payments)
      .values({
        contractor_id: data.contractor_id,
        project_id: data.project_id,
        amount: String(data.amount),
        payment_date: data.payment_date,
        payment_method: data.payment_method,
        reference_number: data.reference_number || null,
        notes: data.notes || null,
        status: data.already_paid ? "paid" : "pending",
        created_by: user.id,
      })
      .returning({ id: contractor_payments.id, status: contractor_payments.status })

    return NextResponse.json({ success: true, data: payment }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: "Error al registrar pago" }, { status: 500 })
  }
}
