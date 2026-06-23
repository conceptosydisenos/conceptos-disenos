import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import * as XLSX from "xlsx"
import { db } from "@/lib/db"
import { clients, projects, contractors, invoices, audit_logs } from "@/lib/db/schema"
import { requireRole } from "@/lib/auth"
import { eq, or } from "drizzle-orm"
import { z } from "zod"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Validation schemas ────────────────────────────────────────

const importedClientSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  nit: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
})

const importedProjectSchema = z.object({
  name: z.string().min(1),
  client_name: z.string().min(1),
  description: z.string().optional().nullable(),
  status: z.enum(["active", "paused", "completed", "in_warranty", "cancelled"]).default("active"),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  quoted_amount: z.number().positive().optional().nullable(),
  advance_percentage: z.number().min(0).max(100).default(50),
})

const importedContractorSchema = z.object({
  name: z.string().min(1),
  specialty: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().nullable(),
  nit: z.string().optional().nullable(),
  contractor_type: z.enum(["persona_natural", "empresa"]).default("persona_natural"),
})

const importedInvoiceSchema = z.object({
  invoice_number: z.string().min(1),
  supplier_name: z.string().min(1),
  supplier_nit: z.string().optional().nullable(),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  total_amount: z.number().positive(),
  subtotal: z.number().min(0).optional().nullable(),
  tax_amount: z.number().min(0).default(0),
  notes: z.string().optional().nullable(),
})

const claudeResponseSchema = z.object({
  clients: z.array(importedClientSchema).default([]),
  projects: z.array(importedProjectSchema).default([]),
  contractors: z.array(importedContractorSchema).default([]),
  invoices: z.array(importedInvoiceSchema).default([]),
  unrecognized: z.array(z.string()).default([]),
})

type ImportSummary = {
  clients: { created: number; skipped: number }
  projects: { created: number; skipped: number }
  contractors: { created: number; skipped: number }
  invoices: { created: number; skipped: number }
  unrecognized: string[]
  errors: string[]
}

const SYSTEM_PROMPT = `Eres un asistente especializado en migración de datos históricos para una firma de arquitectura y remodelación colombiana llamada Conceptos y Diseños.

El usuario ha subido archivos Excel directamente. Cada hoja del Excel se presenta como una sección CSV con el encabezado "=== Hoja: [nombre] ===". Los datos pueden tener estructuras muy distintas: columnas en diferentes órdenes, varias hojas con distintos tipos de registros, valores en texto libre, etc.

Tu tarea es analizar el contenido y extraer datos estructurados para importar a estas tablas de base de datos:

1. **clients** (clientes del negocio): name, email, phone, nit, address
2. **projects** (proyectos de obra): name, client_name, description, status, start_date (YYYY-MM-DD), quoted_amount (número en COP), advance_percentage (0-100)
3. **contractors** (contratistas/trabajadores): name, specialty, phone, email, nit, contractor_type (persona_natural|empresa)
4. **invoices** (facturas de materiales y gastos): invoice_number, supplier_name, supplier_nit, invoice_date (YYYY-MM-DD), total_amount (COP), subtotal, tax_amount, notes

Reglas de conversión:
- Fechas colombianas (DD/MM/YYYY o DD-MM-YYYY) → YYYY-MM-DD
- Montos en COP con puntos de miles: "1.500.000" → 1500000, "$2.300.000" → 2300000
- Contratistas: maestro de obra, electricista, plomero, carpintero, pintor, etc. → specialty
- Si un valor no está disponible o no es legible, usa null
- No inventes datos — si no aparece claramente en los datos, omítelo
- Cualquier sección que no puedas clasificar con confianza, descríbela en unrecognized

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin explicaciones:
{
  "clients": [...],
  "projects": [...],
  "contractors": [...],
  "invoices": [...],
  "unrecognized": ["descripción de datos que no pudiste clasificar"]
}`

function excelBufferToText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const sections: string[] = []
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(sheet)
    if (csv.trim()) {
      sections.push(`=== Hoja: ${sheetName} ===\n${csv}`)
    }
  }
  return sections.join("\n\n")
}

async function parseMarkdownWithClaude(content: string): Promise<z.infer<typeof claudeResponseSchema>> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Analiza estos datos extraídos de un Excel e importa los registros:\n\n${content}`,
      },
    ],
  })

  const text = message.content[0].type === "text" ? message.content[0].text.trim() : ""
  const jsonStr = text.replace(/^```json\s*|\s*```$/g, "").trim()

  try {
    const raw = JSON.parse(jsonStr)
    return claudeResponseSchema.parse(raw)
  } catch {
    return { clients: [], projects: [], contractors: [], invoices: [], unrecognized: ["No se pudo interpretar la respuesta de la IA"] }
  }
}

async function findOrCreateClient(
  name: string,
  nit: string | null | undefined,
  userId: string
): Promise<string | null> {
  const existing = await db
    .select({ id: clients.id })
    .from(clients)
    .where(
      nit
        ? or(eq(clients.name, name), eq(clients.nit, nit))
        : eq(clients.name, name)
    )
    .limit(1)

  if (existing[0]) return existing[0].id

  const [created] = await db
    .insert(clients)
    .values({ name, nit: nit ?? null })
    .returning({ id: clients.id })

  return created?.id ?? null
}


const MAX_IMPORT_FILES = 5

export async function POST(req: NextRequest) {
  const user = await requireRole(["admin"])

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ success: false, error: "Request inválido" }, { status: 400 })
  }

  const fileEntries = formData.getAll("files") as File[]

  if (fileEntries.length === 0) {
    return NextResponse.json({ success: false, error: "Debes enviar al menos un archivo" }, { status: 400 })
  }

  if (fileEntries.length > MAX_IMPORT_FILES) {
    return NextResponse.json({ success: false, error: `Máximo ${MAX_IMPORT_FILES} archivos por importación` }, { status: 400 })
  }

  const summary: ImportSummary = {
    clients: { created: 0, skipped: 0 },
    projects: { created: 0, skipped: 0 },
    contractors: { created: 0, skipped: 0 },
    invoices: { created: 0, skipped: 0 },
    unrecognized: [],
    errors: [],
  }

  // Parse all Excel files with xlsx → text → Claude
  const allExtracted = await Promise.all(
    fileEntries.map(async (file) => {
      const arrayBuffer = await file.arrayBuffer()
      const text = excelBufferToText(Buffer.from(arrayBuffer))
      return parseMarkdownWithClaude(text)
    })
  )

  // Merge results across all files
  const merged = allExtracted.reduce(
    (acc, cur) => ({
      clients: [...acc.clients, ...cur.clients],
      projects: [...acc.projects, ...cur.projects],
      contractors: [...acc.contractors, ...cur.contractors],
      invoices: [...acc.invoices, ...cur.invoices],
      unrecognized: [...acc.unrecognized, ...cur.unrecognized],
    }),
    { clients: [], projects: [], contractors: [], invoices: [], unrecognized: [] } as z.infer<typeof claudeResponseSchema>
  )

  summary.unrecognized = merged.unrecognized

  // 1. Import clients (find or create)
  const clientIdMap = new Map<string, string>()
  for (const c of merged.clients) {
    try {
      const existing = await db
        .select({ id: clients.id })
        .from(clients)
        .where(
          c.nit
            ? or(eq(clients.name, c.name), eq(clients.nit, c.nit))
            : eq(clients.name, c.name)
        )
        .limit(1)

      if (existing[0]) {
        clientIdMap.set(c.name, existing[0].id)
        summary.clients.skipped++
        continue
      }

      const [created] = await db
        .insert(clients)
        .values({
          name: c.name,
          email: c.email ?? null,
          phone: c.phone ?? null,
          nit: c.nit ?? null,
          address: c.address ?? null,
        })
        .returning({ id: clients.id })

      if (created) {
        clientIdMap.set(c.name, created.id)
        summary.clients.created++
      }
    } catch (err) {
      summary.errors.push(`Cliente "${c.name}": ${err instanceof Error ? err.message : "error desconocido"}`)
    }
  }

  // 2. Import contractors
  for (const c of merged.contractors) {
    try {
      const existing = await db
        .select({ id: contractors.id })
        .from(contractors)
        .where(eq(contractors.name, c.name))
        .limit(1)

      if (existing[0]) {
        summary.contractors.skipped++
        continue
      }

      await db.insert(contractors).values({
        name: c.name,
        specialty: c.specialty,
        phone: c.phone,
        email: c.email ?? null,
        nit: c.nit ?? null,
        contractor_type: c.contractor_type,
      })
      summary.contractors.created++
    } catch (err) {
      summary.errors.push(`Contratista "${c.name}": ${err instanceof Error ? err.message : "error desconocido"}`)
    }
  }

  // 3. Import projects (need client_id)
  const projectIdMap = new Map<string, string>()
  for (const p of merged.projects) {
    try {
      // Find or create the client referenced by this project
      let clientId = clientIdMap.get(p.client_name)
      if (!clientId) {
        const id = await findOrCreateClient(p.client_name, null, user.id)
        if (id) {
          clientId = id
          clientIdMap.set(p.client_name, id)
        }
      }

      if (!clientId) {
        summary.errors.push(`Proyecto "${p.name}": no se pudo encontrar/crear el cliente "${p.client_name}"`)
        summary.projects.skipped++
        continue
      }

      const existing = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.name, p.name))
        .limit(1)

      if (existing[0]) {
        projectIdMap.set(p.name, existing[0].id)
        summary.projects.skipped++
        continue
      }

      const [created] = await db
        .insert(projects)
        .values({
          client_id: clientId,
          name: p.name,
          description: p.description ?? null,
          status: p.status,
          start_date: p.start_date ?? new Date().toISOString().split("T")[0],
          quoted_amount: String(p.quoted_amount ?? 0),
          advance_percentage: String(p.advance_percentage),
          contingency_percentage: "15.00",
          created_by: user.id,
        })
        .returning({ id: projects.id })

      if (created) {
        projectIdMap.set(p.name, created.id)
        summary.projects.created++
        await db.insert(audit_logs).values({
          user_id: user.id,
          action: "create",
          entity_type: "project",
          entity_id: created.id,
          new_values: { source: "excel_import", name: p.name },
        })
      }
    } catch (err) {
      summary.errors.push(`Proyecto "${p.name}": ${err instanceof Error ? err.message : "error desconocido"}`)
    }
  }

  // 4. Import invoices
  for (const inv of merged.invoices) {
    try {
      const existing = await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(eq(invoices.invoice_number, inv.invoice_number))
        .limit(1)

      if (existing[0]) {
        summary.invoices.skipped++
        continue
      }

      const subtotal = inv.subtotal ?? (inv.total_amount / 1.19)
      const taxAmount = inv.tax_amount ?? (inv.total_amount - subtotal)

      const [created] = await db
        .insert(invoices)
        .values({
          invoice_number: inv.invoice_number,
          supplier_name: inv.supplier_name,
          supplier_nit: inv.supplier_nit ?? null,
          invoice_date: inv.invoice_date,
          subtotal: String(subtotal.toFixed(2)),
          tax_amount: String(taxAmount.toFixed(2)),
          total_amount: String(inv.total_amount.toFixed(2)),
          image_url: "importado:excel",
          notes: inv.notes ?? null,
          status: "pending_allocation",
          created_by: user.id,
        })
        .returning({ id: invoices.id })

      if (created) {
        summary.invoices.created++
        await db.insert(audit_logs).values({
          user_id: user.id,
          action: "create",
          entity_type: "invoice",
          entity_id: created.id,
          new_values: { source: "excel_import", invoice_number: inv.invoice_number },
        })
      }
    } catch (err) {
      summary.errors.push(`Factura "${inv.invoice_number}": ${err instanceof Error ? err.message : "error desconocido"}`)
    }
  }

  return NextResponse.json({
    success: true,
    data: summary,
  })
}
