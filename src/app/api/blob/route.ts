import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
])

function isVercelBlobHost(raw: string): { valid: boolean; parsed?: URL } {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { valid: false }
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "")

  if (
    parsed.protocol !== "https:" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    !hostname.endsWith(".vercel-storage.com")
  ) {
    return { valid: false }
  }

  return { valid: true, parsed }
}

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return new NextResponse("Unauthorized", { status: 401 })

  const url = req.nextUrl.searchParams.get("url")
  if (!url) return new NextResponse("Missing url", { status: 400 })

  const { valid } = isVercelBlobHost(url)
  if (!valid) return new NextResponse("Invalid url", { status: 400 })

  const blobResponse = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
    },
    redirect: "manual",
  })

  // Refuse to follow any redirect — re-validation would be needed
  if (blobResponse.status >= 300 && blobResponse.status < 400) {
    return new NextResponse("Image not found", { status: 404 })
  }

  if (!blobResponse.ok) {
    return new NextResponse("Image not found", { status: blobResponse.status })
  }

  const rawType = blobResponse.headers.get("content-type")?.split(";")[0].trim() ?? ""
  if (!ALLOWED_CONTENT_TYPES.has(rawType)) {
    return new NextResponse("Unsupported media type", { status: 415 })
  }

  const data = await blobResponse.arrayBuffer()

  return new NextResponse(data, {
    headers: {
      "Content-Type": rawType,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
      "Content-Disposition": "inline",
    },
  })
}
