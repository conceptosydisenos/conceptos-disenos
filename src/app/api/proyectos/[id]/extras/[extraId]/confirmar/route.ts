import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { project_extras, audit_logs } from "@/lib/db/schema"
import { requireRole } from "@/lib/auth"
import { eq, and } from "drizzle-orm"

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; extraId: string } }
) {
  try {
    const user = await requireRole(["admin"])

    const [extra] = await db
      .select()
      .from(project_extras)
      .where(
        and(
          eq(project_extras.id, params.extraId),
          eq(project_extras.project_id, params.id)
        )
      )
      .limit(1)

    if (!extra) {
      return NextResponse.json({ success: false, error: "Adicional no encontrado" }, { status: 404 })
    }
    if (extra.status === "approved") {
      return NextResponse.json({ success: false, error: "Este adicional ya fue confirmado" }, { status: 409 })
    }

    const [updated] = await db
      .update(project_extras)
      .set({
        status: "approved",
        approved_by: user.id,
        approved_at: new Date(),
      })
      .where(eq(project_extras.id, params.extraId))
      .returning()

    await db.insert(audit_logs).values({
      user_id: user.id,
      action: "approve",
      entity_type: "project_extra",
      entity_id: params.extraId,
      new_values: { status: "approved", value: extra.value, description: extra.description },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Forbidden")) {
      return NextResponse.json({ success: false, error: "Solo administradores pueden confirmar adicionales" }, { status: 403 })
    }
    return NextResponse.json({ success: false, error: "Error al confirmar adicional" }, { status: 500 })
  }
}
