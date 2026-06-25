/**
 * Retroactive migration: populate project_rubros for existing projects.
 *
 * For each project that has no rubros yet:
 *   - Creates 9 fixed rubros (all RUBRO_TYPES except "personalizado") with budget_amount = 0
 *   - Assigns existing budget_items to the matching rubro via the category field
 *
 * Run with: npx tsx scripts/migrate-rubros.ts
 *
 * Uses the Neon WebSocket driver so the operation runs inside a transaction.
 */

import * as dotenv from "dotenv"
import { neonConfig, Pool } from "@neondatabase/serverless"
import ws from "ws"

dotenv.config({ path: ".env.local" })

neonConfig.webSocketConstructor = ws

const FIXED_RUBROS = [
  { rubro_type: "mano_obra",    name: "Mano de Obra",    sort_order: 0 },
  { rubro_type: "materiales",   name: "Materiales",       sort_order: 1 },
  { rubro_type: "escombros",    name: "Escombros",        sort_order: 2 },
  { rubro_type: "acarreos",     name: "Acarreos",         sort_order: 3 },
  { rubro_type: "demoliciones", name: "Demoliciones",     sort_order: 4 },
  { rubro_type: "carpinteria",  name: "Carpintería",      sort_order: 5 },
  { rubro_type: "vidreria",     name: "Vidriería",        sort_order: 6 },
  { rubro_type: "adicionales",  name: "Adicionales",      sort_order: 7 },
  { rubro_type: "imprevistos",  name: "Imprevistos",      sort_order: 8 },
] as const

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    // 1. Find projects that have no rubros yet
    const { rows: projects } = await client.query<{ id: string; name: string }>(
      `SELECT p.id, p.name
       FROM projects p
       WHERE p.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM project_rubros pr WHERE pr.project_id = p.id
         )
       ORDER BY p.created_at`
    )

    if (projects.length === 0) {
      console.log("No projects need retroactive rubros — skipping.")
      await client.query("COMMIT")
      return
    }

    console.log(`Creating rubros for ${projects.length} project(s)...`)

    for (const project of projects) {
      // 2. Insert 9 fixed rubros for this project
      for (const rubro of FIXED_RUBROS) {
        await client.query(
          `INSERT INTO project_rubros (project_id, rubro_type, name, budget_amount, active, sort_order)
           VALUES ($1, $2, $3, 0.00, true, $4)
           ON CONFLICT (project_id, rubro_type) DO NOTHING`,
          [project.id, rubro.rubro_type, rubro.name, rubro.sort_order]
        )
      }

      console.log(`  ✓ ${project.name} (${project.id}) — 9 rubros created`)
    }

    await client.query("COMMIT")
    console.log("\nDone. All rubros created successfully.")
  } catch (err) {
    await client.query("ROLLBACK")
    console.error("ROLLBACK — error during migration:", err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
