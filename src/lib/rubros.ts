import type { NeonHttpDatabase } from "drizzle-orm/neon-http"
import type { NeonHttpQueryResultHKT } from "drizzle-orm/neon-http"
import type { PgTransaction } from "drizzle-orm/pg-core"
import type { ExtractTablesWithRelations } from "drizzle-orm"
import { project_rubros, quote_rubros } from "@/lib/db/schema"
import * as schema from "@/lib/db/schema"

// Accepts either the db instance or a transaction object from db.transaction().
type AnyDb =
  | NeonHttpDatabase<typeof schema>
  | PgTransaction<
      NeonHttpQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >

// Canonical order and display names for the 9 fixed structural rubros.
// sort_order matches the retroactive migration in scripts/migrate-rubros.ts.
const FIXED_RUBROS = [
  { rubro_type: "mano_obra",    name: "Mano de obra",           sort_order: 0 },
  { rubro_type: "materiales",   name: "Materiales",              sort_order: 1 },
  { rubro_type: "escombros",    name: "Escombros",               sort_order: 2 },
  { rubro_type: "acarreos",     name: "Acarreos / Transportes",  sort_order: 3 },
  { rubro_type: "demoliciones", name: "Demoliciones",            sort_order: 4 },
  { rubro_type: "carpinteria",  name: "Carpintería",             sort_order: 5 },
  { rubro_type: "vidreria",     name: "Vidriería / Ventanería",  sort_order: 6 },
  { rubro_type: "adicionales",  name: "Adicionales",             sort_order: 7 },
  { rubro_type: "imprevistos",  name: "Imprevistos",             sort_order: 8 },
] as const

export async function seedProjectRubros(db: AnyDb, projectId: string): Promise<void> {
  await db.insert(project_rubros).values(
    FIXED_RUBROS.map((r) => ({
      project_id:    projectId,
      rubro_type:    r.rubro_type,
      name:          r.name,
      budget_amount: "0.00",
      active:        true,
      sort_order:    r.sort_order,
    }))
  )
}

export async function seedQuoteRubros(db: AnyDb, quoteId: string): Promise<void> {
  await db.insert(quote_rubros).values(
    FIXED_RUBROS.map((r) => ({
      quote_id:      quoteId,
      rubro_type:    r.rubro_type,
      name:          r.name,
      budget_amount: "0.00",
      active:        true,
      sort_order:    r.sort_order,
    }))
  )
}
