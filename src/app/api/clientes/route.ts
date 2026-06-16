import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { clients } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { asc } from "drizzle-orm"

export async function GET() {
  try {
    await requireAuth()
    const rows = await db
      .select({ id: clients.id, name: clients.name, nit: clients.nit })
      .from(clients)
      .orderBy(asc(clients.name))
    return NextResponse.json({ success: true, data: rows })
  } catch {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
  }
}

const createSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  nit: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    await requireAuth()
    const body = await req.json()
    const data = createSchema.parse(body)

    const [client] = await db
      .insert(clients)
      .values({
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        nit: data.nit || null,
      })
      .returning()

    return NextResponse.json({ success: true, data: client }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: "Error al crear cliente" }, { status: 500 })
  }
}
