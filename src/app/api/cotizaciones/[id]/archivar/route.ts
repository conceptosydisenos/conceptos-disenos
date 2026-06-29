import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { quotes } from "@/lib/db/schema"
import { requireRole } from "@/lib/auth"
import { eq } from "drizzle-orm"

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(["admin"])

    const [current] = await db
      .select({ archived: quotes.archived })
      .from(quotes)
      .where(eq(quotes.id, params.id))

    if (!current) {
      return NextResponse.json({ success: false, error: "No encontrada" }, { status: 404 })
    }

    await db
      .update(quotes)
      .set({ archived: !current.archived, updated_at: new Date() })
      .where(eq(quotes.id, params.id))

    return NextResponse.json({ success: true, archived: !current.archived })
  } catch {
    return NextResponse.json({ success: false, error: "Error al archivar" }, { status: 500 })
  }
}
