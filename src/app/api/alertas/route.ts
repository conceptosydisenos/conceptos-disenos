import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { getAlerts } from "@/lib/alertas"

export async function GET() {
  try {
    await requireRole(["admin"])
    const alerts = await getAlerts()
    return NextResponse.json({ success: true, data: alerts })
  } catch (err) {
    console.error("[GET /api/alertas]", err)
    const message = err instanceof Error ? err.message : "Error"
    const status = message.startsWith("Forbidden") || message.startsWith("Unauthorized") ? 403 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
