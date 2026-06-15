import { put } from "@vercel/blob"

const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024 // 4MB after compression

export async function uploadInvoiceImage(
  file: File | Blob,
  invoiceId: string
): Promise<string> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `El archivo es demasiado grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo: 4MB.`
    )
  }

  const extension = file instanceof File ? file.name.split(".").pop() || "jpg" : "jpg"
  const filename = `facturas/${invoiceId}-${Date.now()}.${extension}`

  const { url } = await put(filename, file, {
    access: "public",
  })

  return url
}
