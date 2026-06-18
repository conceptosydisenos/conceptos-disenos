import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { work_cuts, audit_logs } from "@/lib/db/schema"
import { requireRole } from "@/lib/auth"
import { and, eq } from "drizzle-orm"

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["admin"])

    // Verify the cut exists first (for a meaningful 404 vs 409 distinction)
    const [existing] = await db
      .select({ status: work_cuts.status })
      .from(work_cuts)
      .where(eq(work_cuts.id, params.id))

    if (!existing) {
      return NextResponse.json({ success: false, error: "Corte no encontrado" }, { status: 404 })
    }

    // Atomic claim — only succeeds if status is still submitted
    const [claimed] = await db
      .update(work_cuts)
      .set({ status: "approved", approved_by: user.id, approved_at: new Date() })
      .where(and(eq(work_cuts.id, params.id), eq(work_cuts.status, "submitted")))
      .returning({ id: work_cuts.id })

    if (!claimed) {
      return NextResponse.json(
        {
          success: false,
          error:
            existing.status === "approved"
              ? "Este corte ya fue aprobado."
              : "Solo se pueden aprobar cortes enviados al cliente.",
        },
        { status: 409 }
      )
    }

    await db.insert(audit_logs).values({
      user_id: user.id,
      action: "approve",
      entity_type: "work_cut",
      entity_id: params.id,
      old_values: { status: "submitted" },
      new_values: { status: "approved", approved_by: user.id },
    })

    return NextResponse.json({ success: true, data: { id: params.id, status: "approved" } })
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Forbidden")) {
      return NextResponse.json({ success: false, error: "Solo administradores pueden aprobar cortes." }, { status: 403 })
    }
    return NextResponse.json({ success: false, error: "Error al aprobar corte" }, { status: 500 })
  }
}
