import type { InferSelectModel, InferInsertModel } from "drizzle-orm"
import type {
  users,
  clients,
  projects,
  budget_items,
  advances,
  contractors,
  project_contractors,
  work_cuts,
  work_cut_items,
  contractor_payments,
  invoices,
  invoice_allocations,
  leads,
  quotes,
  quote_items,
} from "@/lib/db/schema"

// ── DB model types ────────────────────────────────────────────
export type User = InferSelectModel<typeof users>
export type NewUser = InferInsertModel<typeof users>
export type Client = InferSelectModel<typeof clients>
export type NewClient = InferInsertModel<typeof clients>
export type Project = InferSelectModel<typeof projects>
export type NewProject = InferInsertModel<typeof projects>
export type BudgetItem = InferSelectModel<typeof budget_items>
export type NewBudgetItem = InferInsertModel<typeof budget_items>
export type Advance = InferSelectModel<typeof advances>
export type NewAdvance = InferInsertModel<typeof advances>
export type Contractor = InferSelectModel<typeof contractors>
export type ProjectContractor = InferSelectModel<typeof project_contractors>
export type WorkCut = InferSelectModel<typeof work_cuts>
export type NewWorkCut = InferInsertModel<typeof work_cuts>
export type WorkCutItem = InferSelectModel<typeof work_cut_items>
export type ContractorPayment = InferSelectModel<typeof contractor_payments>
export type Invoice = InferSelectModel<typeof invoices>
export type NewInvoice = InferInsertModel<typeof invoices>
export type InvoiceAllocation = InferSelectModel<typeof invoice_allocations>
export type Lead = InferSelectModel<typeof leads>
export type Quote = InferSelectModel<typeof quotes>
export type QuoteItem = InferSelectModel<typeof quote_items>

// ── Domain types ──────────────────────────────────────────────
export type UserRole = "admin" | "operative" | "accountant"
export type ProjectStatus = "active" | "paused" | "completed" | "cancelled"
export type InvoiceStatus = "pending_allocation" | "allocated" | "verified"
export type WorkCutStatus = "draft" | "submitted" | "approved"
export type PaymentMethod = "transferencia" | "efectivo" | "cheque"

// ── Composite types ───────────────────────────────────────────
export interface ProjectWithClient extends Project {
  client: Client
}

export interface ProjectFinancials {
  projectId: string
  quotedAmount: number
  totalBudget: number
  totalAdvances: number
  totalMaterialCost: number
  totalContractorCost: number
  totalCost: number
  margin: number
  marginPercentage: number
  advanceBalance: number
  budgetProgress: number
}

export interface InvoiceWithAllocations extends Invoice {
  allocations: (InvoiceAllocation & { project: Pick<Project, "id" | "name"> })[]
  isOverdue: boolean
  hoursElapsed: number
}

export interface WorkCutWithItems extends WorkCut {
  items: (WorkCutItem & { budget_item: BudgetItem })[]
}

// ── API response types ────────────────────────────────────────
export interface ApiResponse<T> {
  data: T | null
  error: string | null
  success: boolean
}

export function apiSuccess<T>(data: T): ApiResponse<T> {
  return { data, error: null, success: true }
}

export function apiError(message: string): ApiResponse<null> {
  return { data: null, error: message, success: false }
}
