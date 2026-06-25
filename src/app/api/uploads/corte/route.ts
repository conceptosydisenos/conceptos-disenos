import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { GoogleGenerativeAI } from "@google/generative-ai"
import * as XLSX from "xlsx"
import { apiError } from "@/types"

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

const SPREADSHEET_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel",                                           // .xls
  "text/csv",
  "application/csv",
])

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
])

export interface CorteItem {
  actividad: string
  porcentaje: number
  valor: number
}

interface CorteResponse {
  items: CorteItem[]
  total: number
  fuente: "excel" | "ocr"
}

// ── Column header normalisation ───────────────────────────────

const ACTIVIDAD_KEYS = /actividad|descripci[oó]n|descripcion|activity|concepto|ítem|item/i
const PORCENTAJE_KEYS = /^%$|porcentaje|avance|progreso|progress|%\s*avance/i
const VALOR_KEYS = /valor|monto|amount|costo|total|cobrar|pago|price/i

function detectColumn(headers: string[], pattern: RegExp): number {
  for (let i = 0; i < headers.length; i++) {
    if (pattern.test(headers[i].trim())) return i
  }
  return -1
}

// ── Excel / CSV parser ────────────────────────────────────────

function parseSpreadsheet(buffer: ArrayBuffer): CorteItem[] {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array" })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) throw new Error("El archivo no contiene hojas")

  const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName], {
    header: 1,
    defval: "",
  }) as string[][]

  // Find header row (first row that has at least one matching column)
  let headerRowIdx = 0
  let actCol = -1
  let pctCol = -1
  let valCol = -1

  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const row = rows[r].map(String)
    const a = detectColumn(row, ACTIVIDAD_KEYS)
    const p = detectColumn(row, PORCENTAJE_KEYS)
    const v = detectColumn(row, VALOR_KEYS)
    if (a >= 0 || p >= 0 || v >= 0) {
      headerRowIdx = r
      actCol = a
      pctCol = p
      valCol = v
      break
    }
  }

  // Fallback: assume first three columns are actividad / porcentaje / valor
  if (actCol < 0) actCol = 0
  if (pctCol < 0) pctCol = 1
  if (valCol < 0) valCol = 2

  const items: CorteItem[] = []

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r]
    const actividad = String(row[actCol] ?? "").trim()
    if (!actividad) continue

    const porcentaje = parseFloat(String(row[pctCol] ?? "0").replace(/[^0-9.,-]/g, "").replace(",", ".")) || 0
    const valor = parseFloat(String(row[valCol] ?? "0").replace(/[^0-9.,-]/g, "").replace(",", ".")) || 0

    items.push({ actividad, porcentaje, valor })
  }

  if (items.length === 0) throw new Error("No se encontraron filas con datos en el archivo")
  return items
}

// ── Gemini OCR parser ─────────────────────────────────────────

const CORTE_PROMPT = `Analiza este documento de corte de obra / acta de trabajo de construcción.
Extrae la lista de actividades con su porcentaje de avance y valor a cobrar.
Responde SOLO con JSON válido, sin texto adicional ni bloques de código.

Formato requerido:
{
  "items": [
    { "actividad": "descripción de la actividad", "porcentaje": número_0_a_100, "valor": número_en_COP }
  ]
}

Reglas:
- porcentaje: número entre 0 y 100 (sin el símbolo %)
- valor: número en pesos colombianos (COP), sin separadores de miles
- Si un campo no es legible usa 0
- Si no hay actividades claramente identificables, devuelve {"items": []}
- No incluyas actividades con valor 0 y porcentaje 0 a menos que sean explícitas`

async function parseWithGemini(
  buffer: ArrayBuffer,
  mimeType: string
): Promise<CorteItem[]> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
  })

  const base64 = Buffer.from(buffer).toString("base64")

  const result = await model.generateContent([
    CORTE_PROMPT,
    { inlineData: { data: base64, mimeType: mimeType as "image/jpeg" } },
  ])

  const text = result.response.text().trim()

  // Strip markdown fences if present
  const startIdx = text.indexOf("{")
  const endIdx = text.lastIndexOf("}")
  const jsonStr =
    startIdx >= 0 && endIdx > startIdx
      ? text.slice(startIdx, endIdx + 1)
      : text.replace(/```json\n?|\n?```/g, "").trim()

  let parsed: { items?: unknown[] }
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error(
      "Gemini no pudo extraer datos estructurados. Por favor ingrese las actividades manualmente."
    )
  }

  if (!Array.isArray(parsed.items)) {
    throw new Error(
      "No se encontraron actividades en el documento. Por favor ingrese los datos manualmente."
    )
  }

  const items: CorteItem[] = (parsed.items as Record<string, unknown>[])
    .filter((i) => typeof i === "object" && i !== null && typeof i.actividad === "string" && String(i.actividad).trim())
    .map((i) => ({
      actividad:   String(i.actividad).trim(),
      porcentaje:  typeof i.porcentaje === "number" ? i.porcentaje : parseFloat(String(i.porcentaje ?? 0)) || 0,
      valor:       typeof i.valor      === "number" ? i.valor      : parseFloat(String(i.valor      ?? 0)) || 0,
    }))

  if (items.length === 0) {
    throw new Error(
      "No se encontraron actividades en el documento. Por favor ingrese los datos manualmente."
    )
  }

  return items
}

// ── Route handler ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    await requireRole(["admin", "operative"])
  } catch {
    return NextResponse.json(apiError("No autorizado"), { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json(apiError("Cuerpo de solicitud inválido"), { status: 400 })
  }

  const file = formData.get("file") as File | null
  if (!file) {
    return NextResponse.json(apiError("No se recibió ningún archivo"), { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(apiError("Archivo demasiado grande. Máximo 10MB."), { status: 400 })
  }

  // Detect file type — prefer extension over MIME for xlsx (browsers vary)
  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  const isSpreadsheet =
    ["xlsx", "xls", "csv"].includes(ext) || SPREADSHEET_TYPES.has(file.type)
  const isImageOrPdf =
    ["jpg", "jpeg", "png", "webp", "pdf"].includes(ext) || IMAGE_TYPES.has(file.type)

  if (!isSpreadsheet && !isImageOrPdf) {
    return NextResponse.json(
      apiError("Tipo de archivo no permitido. Use Excel (.xlsx/.xls), CSV, imagen (JPG/PNG/WebP) o PDF."),
      { status: 400 }
    )
  }

  const buffer = await file.arrayBuffer()

  try {
    let items: CorteItem[]
    let fuente: "excel" | "ocr"

    if (isSpreadsheet) {
      items = parseSpreadsheet(buffer)
      fuente = "excel"
    } else {
      const mimeType =
        ext === "pdf"
          ? "application/pdf"
          : file.type.startsWith("image/")
          ? file.type
          : "image/jpeg"
      items = await parseWithGemini(buffer, mimeType)
      fuente = "ocr"
    }

    const total = items.reduce((sum, i) => sum + i.valor, 0)
    const response: CorteResponse = { items, total, fuente }

    return NextResponse.json({ success: true, data: response })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al procesar el archivo"
    return NextResponse.json(apiError(msg), { status: 422 })
  }
}
