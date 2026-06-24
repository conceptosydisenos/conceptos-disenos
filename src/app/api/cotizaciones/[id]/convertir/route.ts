import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { convertQuoteToProject } from "@/lib/convertQuoteToProject"

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["admin"])
    const result = await convertQuoteToProject(params.id, user.id)
    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al convertir"
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
