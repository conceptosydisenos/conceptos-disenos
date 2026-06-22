import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { leads } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { desc, eq, isNull } from "drizzle-orm"
import { z } from "zod"

const createSchema = z.object({
  contact_name: z.string().min(1).max(200),
  contact_phone: z.string().min(1).max(50),
  contact_email: z.string().email().optional().or(z.literal("")),
  project_description: z.string().min(1).max(2000),
  project_address: z.string().max(500).optional(),
  estimated_value: z.coerce.number().positive().optional(),
  source: z.enum(["referido", "voz_a_voz", "volante", "aliado", "web", "redes", "whatsapp", "llamada_directa", "otro"]),
  notes: z.string().max(2000).optional(),
})

export async function GET(_req: Request) {
  try {
    const user = await requireAuth()

    const rows = await db
      .select()
      .from(leads)
      .where(isNull(leads.deleted_at))
      .orderBy(desc(leads.created_at))

    return NextResponse.json({ success: true, data: rows })
  } catch {
    return NextResponse.json({ success: false, error: "Error al cargar leads" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth()

    const body: unknown = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 })
    }

    const { estimated_value, contact_email, ...rest } = parsed.data

    const [lead] = await db
      .insert(leads)
      .values({
        ...rest,
        contact_email: contact_email || null,
        estimated_value: estimated_value != null ? String(estimated_value) : null,
        assigned_to: user.id,
      })
      .returning()

    return NextResponse.json({ success: true, data: lead }, { status: 201 })
  } catch {
    return NextResponse.json({ success: false, error: "Error al crear lead" }, { status: 500 })
  }
}
