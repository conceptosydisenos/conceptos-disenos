import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { quotes, leads, clients } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { desc, eq, isNull } from "drizzle-orm"
import { z } from "zod"
import { generateQuoteNumber } from "@/lib/quoteNumber"
import { calculateQuoteTotals } from "@/lib/calculations"
import { seedQuoteRubros } from "@/lib/rubros"

const createSchema = z.object({
  project_name:           z.string().min(1).max(300),
  description:            z.string().max(2000).optional(),
  lead_id:                z.string().uuid().optional(),
  client_id:              z.string().uuid().optional(),
  contact_name:           z.string().max(200).optional(),
  contact_phone:          z.string().max(50).optional(),
  contact_email:          z.string().email().optional().or(z.literal("")),
  valid_until:            z.string().min(1),
  discount_percentage:    z.coerce.number().min(0).max(100).default(0),
  tax_percentage:         z.coerce.number().min(0).max(100).default(0),
  advance_percentage:     z.coerce.number().min(0).max(100).default(50),
  contingency_percentage: z.coerce.number().min(0).max(100).default(15),
})

export async function GET(_req: Request) {
  try {
    await requireAuth()

    const rows = await db
      .select({
        id:             quotes.id,
        quote_number:   quotes.quote_number,
        project_name:   quotes.project_name,
        contact_name:   quotes.contact_name,
        status:         quotes.status,
        total_amount:   quotes.total_amount,
        valid_until:    quotes.valid_until,
        lead_id:        quotes.lead_id,
        client_id:      quotes.client_id,
        created_at:     quotes.created_at,
        client_name:    clients.name,
      })
      .from(quotes)
      .leftJoin(clients, eq(quotes.client_id, clients.id))
      .where(isNull(quotes.deleted_at))
      .orderBy(desc(quotes.created_at))

    return NextResponse.json({ success: true, data: rows })
  } catch {
    return NextResponse.json({ success: false, error: "Error al cargar cotizaciones" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth()

    const body: unknown = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 })
    }

    const d = parsed.data
    const year = new Date().getFullYear()
    const quote_number = await generateQuoteNumber(year)

    // Pre-populate contact info from lead if provided
    let contactName  = d.contact_name
    let contactPhone = d.contact_phone
    let contactEmail = d.contact_email

    if (d.lead_id) {
      const [lead] = await db
        .select({ contact_name: leads.contact_name, contact_phone: leads.contact_phone, contact_email: leads.contact_email })
        .from(leads)
        .where(eq(leads.id, d.lead_id))

      if (lead) {
        contactName  = contactName  ?? lead.contact_name
        contactPhone = contactPhone ?? lead.contact_phone
        contactEmail = contactEmail ?? (lead.contact_email ?? undefined)
      }
    }

    const totals = calculateQuoteTotals([], d.discount_percentage, d.tax_percentage, d.advance_percentage)

    const quote = await db.transaction(async (tx) => {
      const [q] = await tx
        .insert(quotes)
        .values({
          quote_number,
          lead_id:                d.lead_id    ?? null,
          client_id:              d.client_id  ?? null,
          project_name:           d.project_name,
          description:            d.description ?? null,
          contact_name:           contactName   ?? null,
          contact_phone:          contactPhone  ?? null,
          contact_email:          contactEmail  ?? null,
          valid_until:            d.valid_until,
          discount_percentage:    String(d.discount_percentage),
          tax_percentage:         String(d.tax_percentage),
          advance_percentage:     String(d.advance_percentage),
          contingency_percentage: String(d.contingency_percentage),
          subtotal_amount:        String(totals.subtotal_amount),
          discount_amount:        String(totals.discount_amount),
          tax_amount:             String(totals.tax_amount),
          total_amount:           String(totals.total_amount),
          advance_amount:         String(totals.advance_amount),
          created_by:             user.id,
        })
        .returning()

      await seedQuoteRubros(tx, q.id)
      return q
    })

    return NextResponse.json({ success: true, data: quote }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/cotizaciones]", err)
    return NextResponse.json({ success: false, error: "Error al crear cotización" }, { status: 500 })
  }
}
