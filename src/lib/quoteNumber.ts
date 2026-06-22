import { db } from "@/lib/db"
import { quotes } from "@/lib/db/schema"
import { like, desc } from "drizzle-orm"

/**
 * Generates the next sequential quote number for the given year.
 * Format: COT-YYYY-NNNN (resets to 0001 each year).
 * NOTE: low-traffic internal app — a duplicate will be caught by the
 *       unique index quotes_number_version_uq at the DB level.
 */
export async function generateQuoteNumber(year: number): Promise<string> {
  const prefix = `COT-${year}-`

  const [latest] = await db
    .select({ quote_number: quotes.quote_number })
    .from(quotes)
    .where(like(quotes.quote_number, `${prefix}%`))
    .orderBy(desc(quotes.quote_number))
    .limit(1)

  let seq = 1
  if (latest) {
    const parts = latest.quote_number.split("-")
    const last = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(last)) seq = last + 1
  }

  return `${prefix}${String(seq).padStart(4, "0")}`
}
