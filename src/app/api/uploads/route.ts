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

  const MAX_SIZE = 10 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      apiError("Archivo demasiado grande. Máximo 10MB."),
      { status: 400 }
    )
  }

  const filename = `facturas/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`

  try {
    const { url } = await put(filename, file, { access: "public" })
    return NextResponse.json(apiSuccess({ url }))
  } catch (err) {
    console.error("[uploads] Blob upload failed:", {
      error: err instanceof Error ? err.message : String(err),
      filename,
      fileSize: file.size,
      fileType: file.type,
      hasBlobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    })
    const message = !process.env.BLOB_READ_WRITE_TOKEN
      ? "BLOB_READ_WRITE_TOKEN no configurado en Vercel → Settings → Environment Variables."
      : `Error al subir imagen: ${err instanceof Error ? err.message : "desconocido"}. Revisa los logs en Vercel.`
    return NextResponse.json(apiError(message), { status: 500 })
  }
}
