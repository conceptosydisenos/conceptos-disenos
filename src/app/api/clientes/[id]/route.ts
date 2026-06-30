import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { clients, projects } from "@/lib/db/schema"
import { requireRole } from "@/lib/auth"
import { eq, count } from "drizzle-orm"

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"])
    const [client] = await db.select().from(clients).where(eq(clients.id, params.id))
    if (!client) return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 })
    return NextResponse.json({ success: true, data: client })
  } catch {
    return NextResponse.json({ success: false, error: "Error al cargar cliente" }, { status: 500 })
  }
}

const updateSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres").optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  nit: z.string().optional(),
  archived: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"])
    const body = await req.json()
    const data = updateSchema.parse(body)

    const [updated] = await db
      .update(clients)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email || null }),
        ...(data.phone !== undefined && { phone: data.phone || null }),
        ...(data.address !== undefined && { address: data.address || null }),
        ...(data.nit !== undefined && { nit: data.nit || null }),
        ...(data.archived !== undefined && { archived: data.archived }),
        updated_at: new Date(),
      })
      .where(eq(clients.id, params.id))
      .returning()

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: "Error al actualizar cliente" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"])

    const [client] = await db
      .select({ archived: clients.archived })
      .from(clients)
      .where(eq(clients.id, params.id))

    if (!client) return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 })
    if (!client.archived) {
      return NextResponse.json(
        { success: false, error: "Debes archivar el cliente antes de eliminarlo" },
        { status: 400 }
      )
    }

    const [{ total }] = await db
      .select({ total: count() })
      .from(projects)
      .where(eq(projects.client_id, params.id))

    if (total > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Este cliente tiene ${total} proyecto${total !== 1 ? "s" : ""} asociado${total !== 1 ? "s" : ""}. Elimina los proyectos primero.`,
        },
        { status: 400 }
      )
    }

    await db.delete(clients).where(eq(clients.id, params.id))
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: "Error al eliminar cliente" }, { status: 500 })
  }
}
