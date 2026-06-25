import {
  pgTable,
  uuid,
  text,
  numeric,
  date,
  timestamp,
  jsonb,
  integer,
  boolean,
  index,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/pg-core"

// ── Shared timestamp columns ─────────────────────────────────
const timestamps = {
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}

// ── Shared enum constants ─────────────────────────────────────
// Exported so quote_items and budget_items share the exact same values.
// The conversion cotización→proyecto copies quote_items to budget_items;
// a mismatch here would produce invalid rows at runtime.
export const BUDGET_CATEGORIES = [
  "mano_obra",
  "materiales",
  "escombros",
  "acarreos",
  "demoliciones",
  "carpinteria",
  "vidreria",
  "adicionales",
  "imprevistos",
  "equipos",
  "otro",
  "personalizado",
] as const

// Rubro types used in project_rubros / quote_rubros (Fase 1.5).
// Subset of BUDGET_CATEGORIES — the 9 structural rubros + personalizado.
export const RUBRO_TYPES = [
  "mano_obra",
  "materiales",
  "escombros",
  "acarreos",
  "demoliciones",
  "carpinteria",
  "vidreria",
  "adicionales",
  "imprevistos",
  "personalizado",
] as const

export type RubroType = (typeof RUBRO_TYPES)[number]

export const LEAD_SOURCES = [
  "referido",
  "voz_a_voz",
  "volante",
  "aliado",
  "web",
  "redes",
  "whatsapp",
  "llamada_directa",
  "otro",
] as const

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "visit_scheduled",
  "quoted",
  "won",
  "lost",
] as const

export const QUOTE_STATUSES = [
  "draft",
  "sent",
  "approved",
  "rejected",
  "converted",
] as const

export const LEAD_ACTIVITY_TYPES = [
  "llamada",
  "email",
  "visita",
  "whatsapp",
  "nota",
  "cotizacion_enviada",
  "cambio_estado",
] as const

// ── users ────────────────────────────────────────────────────
// Synced from Clerk via webhook at /api/webhooks/clerk
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerk_user_id: text("clerk_user_id").unique().notNull(),
  name: text("name").notNull(),
  email: text("email").unique().notNull(),
  role: text("role", { enum: ["admin", "operative", "accountant"] })
    .notNull()
    .default("operative"),
  ...timestamps,
})

// ── clients ──────────────────────────────────────────────────
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  nit: text("nit"),
  ...timestamps,
})

// ── projects ─────────────────────────────────────────────────
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  client_id: uuid("client_id")
    .references(() => clients.id)
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", {
    enum: ["active", "paused", "completed", "in_warranty", "cancelled"],
  })
    .notNull()
    .default("active"),
  start_date: date("start_date").notNull(),
  estimated_end_date: date("estimated_end_date"),
  actual_end_date: date("actual_end_date"),
  quoted_amount: numeric("quoted_amount", { precision: 15, scale: 2 }).notNull(),
  contingency_percentage: numeric("contingency_percentage", {
    precision: 5,
    scale: 2,
  })
    .notNull()
    .default("15.00"),
  advance_percentage: numeric("advance_percentage", { precision: 5, scale: 2 })
    .notNull()
    .default("50.00"),
  created_by: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps,
})

// ── budget_items ─────────────────────────────────────────────
export const budget_items = pgTable("budget_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  project_id: uuid("project_id")
    .references(() => projects.id)
    .notNull(),
  // Nullable FK: set when the item belongs to a structured rubro.
  // NULL for categories without a matching rubro_type (equipos, otro).
  project_rubro_id: uuid("project_rubro_id").references(() => project_rubros.id),
  category: text("category", { enum: BUDGET_CATEGORIES }).notNull(),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  unit_price: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
  total_price: numeric("total_price", { precision: 15, scale: 2 }).notNull(),
  ...timestamps,
})

// ── advances ─────────────────────────────────────────────────
// Anticipos recibidos del cliente al inicio del proyecto
export const advances = pgTable("advances", {
  id: uuid("id").primaryKey().defaultRandom(),
  project_id: uuid("project_id")
    .references(() => projects.id)
    .notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  payment_date: date("payment_date").notNull(),
  payment_method: text("payment_method", {
    enum: ["transferencia", "efectivo", "cheque"],
  }).notNull(),
  reference_number: text("reference_number"),
  notes: text("notes"),
  created_by: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

// ── contractors ──────────────────────────────────────────────
export const contractors = pgTable("contractors", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  contractor_type: text("contractor_type", {
    enum: ["persona_natural", "empresa"],
  })
    .notNull()
    .default("persona_natural"),
  specialty: text("specialty").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  nit: text("nit"),
  bank_account: text("bank_account"),
  bank_name: text("bank_name"),
  ...timestamps,
})

// ── project_contractors ──────────────────────────────────────
export const project_contractors = pgTable("project_contractors", {
  id: uuid("id").primaryKey().defaultRandom(),
  project_id: uuid("project_id")
    .references(() => projects.id)
    .notNull(),
  contractor_id: uuid("contractor_id")
    .references(() => contractors.id)
    .notNull(),
  contract_amount: numeric("contract_amount", {
    precision: 15,
    scale: 2,
  }).notNull(),
  start_date: date("start_date").notNull(),
  end_date: date("end_date"),
  payment_modality: text("payment_modality", {
    enum: ["quincenal", "por_actividad"],
  })
    .notNull()
    .default("quincenal"),
  status: text("status", { enum: ["active", "completed", "terminated"] })
    .notNull()
    .default("active"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

// ── work_cuts ────────────────────────────────────────────────
// RULE: Once status = 'approved', this record is IMMUTABLE.
// Adjustments must go into the next cut.
export const work_cuts = pgTable("work_cuts", {
  id: uuid("id").primaryKey().defaultRandom(),
  project_id: uuid("project_id")
    .references(() => projects.id)
    .notNull(),
  cut_number: integer("cut_number").notNull(),
  cut_date: date("cut_date").notNull(),
  status: text("status", { enum: ["draft", "submitted", "approved"] })
    .notNull()
    .default("draft"),
  progress_percentage: numeric("progress_percentage", {
    precision: 5,
    scale: 2,
  }).notNull(),
  total_executed: numeric("total_executed", {
    precision: 15,
    scale: 2,
  }).notNull(),
  advance_amortization: numeric("advance_amortization", {
    precision: 15,
    scale: 2,
  }).notNull(),
  amount_to_pay: numeric("amount_to_pay", {
    precision: 15,
    scale: 2,
  }).notNull(),
  notes: text("notes"),
  approved_by: uuid("approved_by").references(() => users.id),
  approved_at: timestamp("approved_at", { withTimezone: true }),
  created_by: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

// ── work_cut_items ───────────────────────────────────────────
export const work_cut_items = pgTable("work_cut_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  work_cut_id: uuid("work_cut_id")
    .references(() => work_cuts.id)
    .notNull(),
  budget_item_id: uuid("budget_item_id")
    .references(() => budget_items.id)
    .notNull(),
  progress_percentage: numeric("progress_percentage", {
    precision: 5,
    scale: 2,
  }).notNull(),
  executed_amount: numeric("executed_amount", {
    precision: 15,
    scale: 2,
  }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

// ── contractor_payments ──────────────────────────────────────
export const contractor_payments = pgTable("contractor_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  work_cut_id: uuid("work_cut_id").references(() => work_cuts.id),
  contractor_id: uuid("contractor_id")
    .references(() => contractors.id)
    .notNull(),
  project_id: uuid("project_id")
    .references(() => projects.id)
    .notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  payment_date: date("payment_date").notNull(),
  payment_method: text("payment_method").notNull(),
  reference_number: text("reference_number"),
  status: text("status", { enum: ["pending", "paid"] })
    .notNull()
    .default("pending"),
  notes: text("notes"),
  created_by: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

// ── invoices ─────────────────────────────────────────────────
// Facturas de materiales — capturadas con cámara + OCR Gemini
export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoice_number: text("invoice_number").notNull(),
  supplier_name: text("supplier_name").notNull(),
  supplier_nit: text("supplier_nit"),
  invoice_date: date("invoice_date").notNull(),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull(),
  tax_amount: numeric("tax_amount", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  total_amount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
  image_url: text("image_url").notNull(),
  ocr_raw_data: jsonb("ocr_raw_data"),
  status: text("status", {
    enum: ["pending_allocation", "allocated", "verified"],
  })
    .notNull()
    .default("pending_allocation"),
  notes: text("notes"),
  created_by: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  ...timestamps,
})

// ── invoice_allocations ──────────────────────────────────────
// The heart of the system: splits one invoice across multiple projects.
export const invoice_allocations = pgTable("invoice_allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoice_id: uuid("invoice_id")
    .references(() => invoices.id)
    .notNull(),
  project_id: uuid("project_id")
    .references(() => projects.id)
    .notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull(),
  category: text("category", { enum: ["materiales", "equipos", "otro"] })
    .notNull()
    .default("materiales"),
  notes: text("notes"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

// ── audit_logs ───────────────────────────────────────────────
export const audit_logs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  action: text("action", {
    enum: ["create", "update", "delete", "approve"],
  }).notNull(),
  entity_type: text("entity_type").notNull(),
  entity_id: uuid("entity_id").notNull(),
  old_values: jsonb("old_values"),
  new_values: jsonb("new_values"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

// ── project_extras ───────────────────────────────────────────
// Adicionales de obra: trabajos no contemplados en cotización original
export const project_extras = pgTable("project_extras", {
  id: uuid("id").primaryKey().defaultRandom(),
  project_id: uuid("project_id")
    .references(() => projects.id)
    .notNull(),
  description: text("description").notNull(),
  value: numeric("value", { precision: 15, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  status: text("status", { enum: ["pending", "approved"] })
    .notNull()
    .default("pending"),
  approved_by: uuid("approved_by").references(() => users.id),
  approved_at: timestamp("approved_at", { withTimezone: true }),
  work_cut_id: uuid("work_cut_id").references(() => work_cuts.id),
  created_by: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

// ── leads [Fase 2] ───────────────────────────────────────────
// Pipeline: new → contacted → quoted → won/lost
// RULE: deleted_at IS NULL on all listings.
// RULE: status='lost' is a commercial outcome (counts in funnel metrics).
//       deleted_at is for spam/duplicates (does NOT count in metrics).
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contact_name: text("contact_name").notNull(),
    contact_phone: text("contact_phone").notNull(),
    contact_email: text("contact_email"),
    project_description: text("project_description").notNull(),
    estimated_value: numeric("estimated_value", { precision: 15, scale: 2 }),
    source: text("source", { enum: LEAD_SOURCES }).notNull().default("otro"),
    status: text("status", { enum: LEAD_STATUSES }).notNull().default("new"),
    assigned_to: uuid("assigned_to").references(() => users.id),
    project_address: text("project_address"),
    next_follow_up_at: timestamp("next_follow_up_at", { withTimezone: true }),
    // Filled ONLY when status = 'won'
    converted_to_client_id: uuid("converted_to_client_id").references(() => clients.id),
    lost_reason: text("lost_reason"),
    closed_at: timestamp("closed_at", { withTimezone: true }),
    notes: text("notes"),
    deleted_at: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => ({
    statusIdx:    index("leads_status_idx").on(t.status),
    assignedIdx:  index("leads_assigned_to_idx").on(t.assigned_to),
    followUpIdx:  index("leads_next_follow_up_idx").on(t.next_follow_up_at),
    convertedIdx: index("leads_converted_client_idx").on(t.converted_to_client_id),
  })
)

// ── lead_activities [Fase 2] ─────────────────────────────────
// Append-only history: calls, emails, visits, notes, automated events.
// Never update a past activity — commercial audit trail.
export const lead_activities = pgTable(
  "lead_activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lead_id: uuid("lead_id").references(() => leads.id).notNull(),
    activity_type: text("activity_type", { enum: LEAD_ACTIVITY_TYPES }).notNull(),
    // When the interaction actually happened (may differ from created_at
    // e.g. retroactive logging of a call made yesterday).
    occurred_at: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    summary: text("summary").notNull(),
    outcome: text("outcome"),
    // For automated status-change events
    previous_status: text("previous_status", { enum: LEAD_STATUSES }),
    new_status: text("new_status", { enum: LEAD_STATUSES }),
    created_by: uuid("created_by").references(() => users.id).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    leadOccurredIdx: index("lead_activities_lead_occurred_idx").on(t.lead_id, t.occurred_at),
  })
)

// ── quotes [Fase 2] ──────────────────────────────────────────
// VERSIONING: each version is a row. parent_quote_id always points to the
//   root (flat chain, no recursion needed). Only is_current_version=true
//   can be approved/converted.
// quote_number format: COT-YYYY-NNNN (generated in app, reset per year).
// RULE: subtotal_amount = Σ(quote_items.total_price)
//       total_amount    = subtotal_amount − discount_amount
// RULE: deleted_at IS NULL on all listings.
export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Human-readable folio shared across versions of the same chain.
    quote_number: text("quote_number").notNull(),
    lead_id: uuid("lead_id").references(() => leads.id),
    client_id: uuid("client_id").references(() => clients.id),
    // ── Versioning ──
    parent_quote_id: uuid("parent_quote_id"), // self-FK defined below via foreignKey()
    version_number: integer("version_number").notNull().default(1),
    is_current_version: boolean("is_current_version").notNull().default(true),
    project_name: text("project_name").notNull(),
    description: text("description"),
    // Contact info on the quote (may differ from client record)
    contact_name: text("contact_name"),
    contact_email: text("contact_email"),
    contact_phone: text("contact_phone"),
    // ── Amounts ──
    // subtotal = Σ(quote_items.total_price)
    // discount = subtotal × discount_percentage / 100
    // tax      = (subtotal − discount) × tax_percentage / 100
    // total    = subtotal − discount + tax
    subtotal_amount: numeric("subtotal_amount", { precision: 15, scale: 2 }).notNull(),
    discount_percentage: numeric("discount_percentage", { precision: 5, scale: 2 }).notNull().default("0.00"),
    discount_amount: numeric("discount_amount", { precision: 15, scale: 2 }).notNull().default("0.00"),
    tax_percentage: numeric("tax_percentage", { precision: 5, scale: 2 }).notNull().default("0.00"),
    tax_amount: numeric("tax_amount", { precision: 15, scale: 2 }).notNull().default("0.00"),
    total_amount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
    advance_percentage: numeric("advance_percentage", { precision: 5, scale: 2 }).notNull().default("50.00"),
    advance_amount: numeric("advance_amount", { precision: 15, scale: 2 }).notNull(),
    contingency_percentage: numeric("contingency_percentage", { precision: 5, scale: 2 }).notNull().default("15.00"),
    status: text("status", { enum: QUOTE_STATUSES }).notNull().default("draft"),
    valid_until: date("valid_until").notNull(),
    // ── State traceability ──
    sent_at: timestamp("sent_at", { withTimezone: true }),
    decided_at: timestamp("decided_at", { withTimezone: true }),
    rejection_reason: text("rejection_reason"),
    // ── Conversion ──
    converted_to_project_id: uuid("converted_to_project_id").references(() => projects.id),
    created_by: uuid("created_by").references(() => users.id).notNull(),
    deleted_at: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => ({
    statusIdx:       index("quotes_status_idx").on(t.status),
    leadIdx:         index("quotes_lead_id_idx").on(t.lead_id),
    clientIdx:       index("quotes_client_id_idx").on(t.client_id),
    parentIdx:       index("quotes_parent_quote_id_idx").on(t.parent_quote_id),
    convertedIdx:    index("quotes_converted_project_idx").on(t.converted_to_project_id),
    numberVersionUq: uniqueIndex("quotes_number_version_uq").on(t.quote_number, t.version_number),
    parentFk: foreignKey({
      columns: [t.parent_quote_id],
      foreignColumns: [t.id],
      name: "quotes_parent_quote_id_fk",
    }),
  })
)

// ── quote_items [Fase 2] ─────────────────────────────────────
// Uses the same BUDGET_CATEGORIES enum as budget_items.
// The conversion quote→project copies these 1:1 into budget_items;
// a category mismatch would produce an invalid insert at runtime.
export const quote_items = pgTable(
  "quote_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quote_id: uuid("quote_id").references(() => quotes.id).notNull(),
    category: text("category", { enum: BUDGET_CATEGORIES }).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    unit: text("unit").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
    unit_price: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
    total_price: numeric("total_price", { precision: 15, scale: 2 }).notNull(),
    sort_order: integer("sort_order").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    quoteIdx: index("quote_items_quote_id_idx").on(t.quote_id),
  })
)

// ── project_rubros [Fase 1.5] ────────────────────────────────
// Structural budget categories for each project.
// 9 fixed rubros (all RUBRO_TYPES except personalizado) are auto-created
// when a project is created or migrated. personalizado is user-added.
export const project_rubros = pgTable(
  "project_rubros",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    project_id: uuid("project_id")
      .references(() => projects.id)
      .notNull(),
    rubro_type: text("rubro_type", { enum: RUBRO_TYPES }).notNull(),
    name: text("name").notNull(),
    budget_amount: numeric("budget_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0.00"),
    active: boolean("active").notNull().default(true),
    sort_order: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => ({
    projectIdx: index("project_rubros_project_id_idx").on(t.project_id),
    projectTypeUq: uniqueIndex("project_rubros_project_type_uq").on(t.project_id, t.rubro_type),
  })
)

// ── quote_rubros [Fase 1.5] ──────────────────────────────────
// Structural budget categories for each quotation.
// Mirrors project_rubros but scoped to quotes; copied to project_rubros
// when a quote is converted to a project.
export const quote_rubros = pgTable(
  "quote_rubros",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quote_id: uuid("quote_id")
      .references(() => quotes.id)
      .notNull(),
    rubro_type: text("rubro_type", { enum: RUBRO_TYPES }).notNull(),
    name: text("name").notNull(),
    budget_amount: numeric("budget_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0.00"),
    active: boolean("active").notNull().default(true),
    sort_order: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => ({
    quoteIdx: index("quote_rubros_quote_id_idx").on(t.quote_id),
    quoteTypeUq: uniqueIndex("quote_rubros_quote_type_uq").on(t.quote_id, t.rubro_type),
  })
)
