import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return new NextResponse("Unauthorized", { status: 401 })

  const url = req.nextUrl.searchParams.get("url")
  if (!url) return new NextResponse("Missing url", { status: 400 })

  // SSRF prevention: only proxy Vercel Blob URLs
  if (!url.startsWith("https://") || !url.includes("vercel-storage.com")) {
    return new NextResponse("Invalid url", { status: 400 })
  }

  const blobResponse = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
    },
  })

  if (!blobResponse.ok) {
    return new NextResponse("Image not found", { status: blobResponse.status })
  }

  const contentType = blobResponse.headers.get("content-type") ?? "image/jpeg"
  const data = await blobResponse.arrayBuffer()

  return new NextResponse(data, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  })
}
