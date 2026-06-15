import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { put } from "@vercel/blob"
import { apiError, apiSuccess } from "@/types"

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json(apiError("Unauthorized"), { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null

  if (!file) {
    return NextResponse.json(apiError("No file provided"), { status: 400 })
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      apiError("Tipo de archivo no permitido. Use JPG, PNG o WebP."),
      { status: 400 }
    )
  }

  const MAX_SIZE = 10 * 1024 * 1024 // 10MB before compression
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      apiError("Archivo demasiado grande. Máximo 10MB."),
      { status: 400 }
    )
  }

  const filename = `facturas/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`
  const { url } = await put(filename, file, { access: "public" })

  return NextResponse.json(apiSuccess({ url }))
}
