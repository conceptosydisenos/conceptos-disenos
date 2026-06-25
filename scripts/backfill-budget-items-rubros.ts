/**
 * Backfill project_rubro_id on existing budget_items.
 *
 * Matches: bi.project_id = pr.project_id AND bi.category = pr.rubro_type
 * Items with category "equipos" or "otro" (not in RUBRO_TYPES) stay NULL.
 *
 * Run with: npx tsx scripts/backfill-budget-items-rubros.ts
 */

import * as dotenv from "dotenv"
import { neonConfig, Pool } from "@neondatabase/serverless"
import ws from "ws"

dotenv.config({ path: ".env.local" })

neonConfig.webSocketConstructor = ws

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    const { rowCount } = await client.query(`
      UPDATE budget_items bi
      SET    project_rubro_id = pr.id
      FROM   project_rubros pr
      WHERE  bi.project_id  = pr.project_id
        AND  bi.category     = pr.rubro_type
        AND  bi.project_rubro_id IS NULL
    `)

    const { rows: unmatched } = await client.query(`
      SELECT category, COUNT(*) AS total
      FROM   budget_items
      WHERE  project_rubro_id IS NULL
      GROUP  BY category
      ORDER  BY category
    `)

    await client.query("COMMIT")

    console.log(`✓ Rows updated: ${rowCount ?? 0}`)

    if (unmatched.length > 0) {
      console.log("\nItems with no matching rubro (project_rubro_id remains NULL):")
      for (const row of unmatched) {
        console.log(`  category="${row.category}": ${row.total} item(s)`)
      }
    } else {
      console.log("All budget_items now have a project_rubro_id.")
    }
  } catch (err) {
    await client.query("ROLLBACK")
    console.error("ROLLBACK — error during backfill:", err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
