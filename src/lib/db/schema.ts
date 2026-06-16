import {
  pgTable,
  uuid,
  text,
  numeric,
  date,
  timestamp,
  jsonb,
  integer,
} from "drizzle-orm/pg-core"

// ── Shared timestamp columns ─────────────────────────────────
const timestamps = {
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}

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
  category: text("category", {
    enum: ["materiales", "mano_obra", "equipos", "imprevistos", "otro"],
  }).notNull(),
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

// ── leads [Fase 2] ───────────────────────────────────────────
export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  contact_name: text("contact_name").notNull(),
  contact_phone: text("contact_phone").notNull(),
  contact_email: text("contact_email"),
  project_description: text("project_description").notNull(),
  estimated_value: numeric("estimated_value", { precision: 15, scale: 2 }),
  source: text("source", {
    enum: ["referido", "web", "redes", "otro"],
  })
    .notNull()
    .default("otro"),
  status: text("status", {
    enum: ["new", "contacted", "quoted", "won", "lost"],
  })
    .notNull()
    .default("new"),
  assigned_to: uuid("assigned_to").references(() => users.id),
  notes: text("notes"),
  ...timestamps,
})

// ── quotes [Fase 2] ──────────────────────────────────────────
export const quotes = pgTable("quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  lead_id: uuid("lead_id").references(() => leads.id),
  client_id: uuid("client_id").references(() => clients.id),
  project_name: text("project_name").notNull(),
  description: text("description"),
  total_amount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
  advance_amount: numeric("advance_amount", {
    precision: 15,
    scale: 2,
  }).notNull(),
  contingency_percentage: numeric("contingency_percentage", {
    precision: 5,
    scale: 2,
  })
    .notNull()
    .default("15.00"),
  status: text("status", {
    enum: ["draft", "sent", "approved", "rejected", "converted"],
  })
    .notNull()
    .default("draft"),
  valid_until: date("valid_until").notNull(),
  converted_to_project_id: uuid("converted_to_project_id").references(
    () => projects.id
  ),
  created_by: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  ...timestamps,
})

// ── quote_items [Fase 2] ─────────────────────────────────────
export const quote_items = pgTable("quote_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  quote_id: uuid("quote_id")
    .references(() => quotes.id)
    .notNull(),
  category: text("category").notNull(),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  unit_price: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
  total_price: numeric("total_price", { precision: 15, scale: 2 }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})
