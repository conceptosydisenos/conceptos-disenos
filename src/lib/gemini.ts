import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export interface ExtractedInvoiceData {
  invoice_number: string | null
  supplier_name: string | null
  supplier_nit: string | null
  invoice_date: string | null
  subtotal: number
  tax_amount: number
  total_amount: number
  items: Array<{
    description: string
    quantity: number
    unit_price: number
    total: number
  }>
  confidence: number
  requires_review: true // CRITICAL: Always true. OCR is never auto-confirmed.
}

const EXTRACTION_PROMPT = `Analiza esta factura colombiana y extrae la información en formato JSON exacto.
No agregues texto adicional — responde SOLO con el JSON.

Formato requerido:
{
  "invoice_number": "número de factura o null si no es legible",
  "supplier_name": "nombre del proveedor o null",
  "supplier_nit": "NIT del proveedor (formato: xxx.xxx.xxx-x) o null",
  "invoice_date": "fecha en formato YYYY-MM-DD o null",
  "subtotal": número (sin IVA, en COP),
  "tax_amount": número (valor del IVA, 0 si no aplica),
  "total_amount": número (total con IVA, en COP),
  "items": [
    {
      "description": "descripción del ítem",
      "quantity": número,
      "unit_price": número,
      "total": número
    }
  ],
  "confidence": número entre 0 y 1 (qué tan legible es la factura)
}

Reglas:
- Usa null para campos no legibles (strings) y 0 para valores numéricos no legibles
- Los montos son en pesos colombianos (COP)
- El IVA en Colombia es 19% — verifica si está incluido en el total
- Si el total no es claro, suma los ítems individuales`

export async function extractInvoiceData(
  imageUrl: string
): Promise<ExtractedInvoiceData> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
    },
  })

  let parsedImageUrl: URL
  try {
    parsedImageUrl = new URL(imageUrl)
  } catch {
    throw new Error("Invalid invoice image URL")
  }
  const isVercelBlob =
    parsedImageUrl.protocol === "https:" &&
    (parsedImageUrl.hostname === "vercel-storage.com" ||
      parsedImageUrl.hostname.toLowerCase().endsWith(".vercel-storage.com"))
  const imageHeaders: Record<string, string> =
    isVercelBlob && process.env.BLOB_READ_WRITE_TOKEN
      ? { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
      : {}

  const imageResponse = await fetch(parsedImageUrl.toString(), {
    headers: imageHeaders,
    redirect: "manual",
  })
  if (!imageResponse.ok || imageResponse.status >= 300) {
    throw new Error(`Failed to fetch invoice image: ${imageResponse.status}`)
  }

  const imageBuffer = await imageResponse.arrayBuffer()
  const base64Image = Buffer.from(imageBuffer).toString("base64")
  const mimeType =
    (imageResponse.headers.get("content-type") as
      | "image/jpeg"
      | "image/png"
      | "image/webp") || "image/jpeg"

  const result = await model.generateContent([
    EXTRACTION_PROMPT,
    {
      inlineData: {
        data: base64Image,
        mimeType,
      },
    },
  ])

  const text = result.response.text().trim()
  // Extract the JSON object robustly — handles markdown code blocks and surrounding text
  const startIdx = text.indexOf("{")
  const endIdx = text.lastIndexOf("}")
  const jsonStr = startIdx >= 0 && endIdx > startIdx
    ? text.slice(startIdx, endIdx + 1)
    : text.replace(/```json\n?|\n?```/g, "").trim()

  let extracted: Omit<ExtractedInvoiceData, "requires_review">
  try {
    extracted = JSON.parse(jsonStr)
  } catch {
    // If parsing fails, return a safe default requiring full manual entry
    extracted = {
      invoice_number: null,
      supplier_name: null,
      supplier_nit: null,
      invoice_date: null,
      subtotal: 0,
      tax_amount: 0,
      total_amount: 0,
      items: [],
      confidence: 0,
    }
  }

  return {
    ...extracted,
    requires_review: true, // ALWAYS true — user must verify before saving
  }
}
