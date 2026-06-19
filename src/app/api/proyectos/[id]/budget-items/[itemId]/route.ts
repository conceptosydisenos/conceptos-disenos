import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { budget_items } from "@/lib/db/schema"
import { requireRole } from "@/lib/auth"
import { and, eq } from "drizzle-orm"

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    await requireRole(["admin"])
    await db
      .delete(budget_items)
      .where(
        and(
          eq(budget_items.id, params.itemId),
          eq(budget_items.project_id, params.id)
        )
      )
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: "Error al eliminar ítem" }, { status: 500 })
  }
}
