import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { extractInvoiceData } from "@/lib/gemini"
import { apiError, apiSuccess } from "@/types"
import { ocrRateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { z } from "zod"

const schema = z.object({
  image_url: z.string().url(),
})

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json(apiError("Unauthorized"), { status: 401 })
  }

  if (ocrRateLimit) {
    const { success, limit, remaining } = await ocrRateLimit.limit(userId)
    if (!success) {
      return NextResponse.json(
        apiError("Demasiadas solicitudes de OCR. Espera un momento antes de procesar otra factura."),
        {
          status: 429,
          headers: rateLimitHeaders(limit, remaining, 60),
        }
      )
    }
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(apiError("image_url requerida"), { status: 400 })
  }

  try {
    const extracted = await extractInvoiceData(parsed.data.image_url)
    return NextResponse.json(apiSuccess(extracted))
  } catch (err) {
    console.error("OCR extraction failed:", err)
    return NextResponse.json(
      apiError("No se pudo procesar la imagen. Intente de nuevo o ingrese los datos manualmente."),
      { status: 500 }
    )
  }
}
