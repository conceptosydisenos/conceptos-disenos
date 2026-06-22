import { db } from "@/lib/db"
import { quotes, quote_items, projects, budget_items, clients, leads } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

interface ConvertResult {
  project_id: string
  project_name: string
}

/**
 * Converts an approved quote to an active project in a single transaction.
 *
 * Steps:
 * 1. Resolve or create a client (uses quote.client_id, else auto-creates from contact info)
 * 2. Create project (quoted_amount = quote.total_amount)
 * 3. Copy quote_items → budget_items
 * 4. Mark quote as converted, set converted_to_project_id
 * 5. If the quote has a lead_id, update lead.converted_to_client_id
 */
export async function convertQuoteToProject(
  quoteId: string,
  createdBy: string,
  startDate: string = new Date().toISOString().split("T")[0]
): Promise<ConvertResult> {
  return db.transaction(async (tx) => {
    const [quote] = await tx
      .select()
      .from(quotes)
      .where(eq(quotes.id, quoteId))

    if (!quote) throw new Error("Cotización no encontrada")
    if (quote.status !== "approved") throw new Error("Solo se pueden convertir cotizaciones aprobadas")
    if (quote.converted_to_project_id) throw new Error("Esta cotización ya fue convertida")

    const items = await tx
      .select()
      .from(quote_items)
      .where(eq(quote_items.quote_id, quoteId))

    // ── Resolve client ───────────────────────────────────────
    let clientId = quote.client_id

    if (!clientId) {
      const [newClient] = await tx
        .insert(clients)
        .values({
          name:  quote.contact_name ?? quote.project_name,
          phone: quote.contact_phone,
          email: quote.contact_email,
        })
        .returning({ id: clients.id })
      clientId = newClient.id
    }

    // ── Create project ───────────────────────────────────────
    const [project] = await tx
      .insert(projects)
      .values({
        client_id:               clientId,
        name:                    quote.project_name,
        description:             quote.description,
        quoted_amount:           quote.total_amount,
        advance_percentage:      quote.advance_percentage,
        contingency_percentage:  quote.contingency_percentage,
        start_date:              startDate,
        created_by:              createdBy,
      })
      .returning({ id: projects.id, name: projects.name })

    // ── Copy items ───────────────────────────────────────────
    if (items.length > 0) {
      await tx.insert(budget_items).values(
        items.map((item) => ({
          project_id: project.id,
          name:       item.name,
          category:   item.category,
          unit:       item.unit,
          quantity:   item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
        }))
      )
    }

    // ── Mark quote converted ─────────────────────────────────
    await tx
      .update(quotes)
      .set({ status: "converted", converted_to_project_id: project.id })
      .where(eq(quotes.id, quoteId))

    // ── Update lead if linked ────────────────────────────────
    if (quote.lead_id) {
      await tx
        .update(leads)
        .set({ converted_to_client_id: clientId })
        .where(eq(leads.id, quote.lead_id))
    }

    return { project_id: project.id, project_name: project.name }
  })
}
