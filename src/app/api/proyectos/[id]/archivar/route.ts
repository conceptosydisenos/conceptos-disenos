import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { projects } from "@/lib/db/schema"
import { requireRole } from "@/lib/auth"
import { eq, sql } from "drizzle-orm"

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(["admin"])

    const [result] = await db
      .update(projects)
      .set({ archived: sql`NOT ${projects.archived}`, updated_at: new Date() })
      .where(eq(projects.id, params.id))
      .returning({ archived: projects.archived })

    if (!result) {
      return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 })
    }

    return NextResponse.json({ success: true, archived: result.archived })
  } catch {
    return NextResponse.json({ success: false, error: "Error al archivar" }, { status: 500 })
  }
}
