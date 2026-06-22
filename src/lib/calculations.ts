/**
 * Financial calculations for Conceptos y Diseños.
 *
 * RULES:
 * 1. Every function here must have a corresponding unit test in tests/calculations.test.ts
 * 2. Never put financial logic inline in components or API routes — always call these functions
 * 3. Once a work cut is approved, its calculated values are locked. Do not recalculate post-approval.
 */

export interface BudgetItemInput {
  id: string
  total_price: string | number
}

export interface ProgressEntry {
  budget_item_id: string
  progress_percentage: string | number
}

// ── Work Cut Calculations ─────────────────────────────────────

/**
 * Calculates total amount executed in a work cut based on activity progress.
 */
export function calculateExecutedAmount(
  budgetItems: BudgetItemInput[],
  progressEntries: ProgressEntry[]
): number {
  const progressMap = new Map(
    progressEntries.map((p) => [
      p.budget_item_id,
      parseFloat(String(p.progress_percentage)),
    ])
  )
  return budgetItems.reduce((total, item) => {
    const progress = progressMap.get(item.id) ?? 0
    const itemTotal = parseFloat(String(item.total_price))
    return total + (itemTotal * progress) / 100
  }, 0)
}

/**
 * Calculates advance amortization for a work cut.
 * Formula: total_executed × (advance_percentage / 100)
 *
 * Carolina's policy: 50% advance is amortized proportionally across each cut.
 */
export function calculateAmortization(
  totalExecuted: number,
  advancePercentage: number | string
): number {
  const pct = parseFloat(String(advancePercentage))
  return (totalExecuted * pct) / 100
}

/**
 * Net amount the client pays for a given cut.
 * Formula: total_executed - advance_amortization
 */
export function calculateNetToPay(
  totalExecuted: number,
  amortization: number
): number {
  return totalExecuted - amortization
}

// ── Project Financial Summary ─────────────────────────────────

export interface ProjectMargin {
  amount: number
  percentage: number
}

/**
 * Calculates project margin based on quoted vs actual cost.
 */
export function calculateProjectMargin(
  quotedAmount: number | string,
  totalCost: number
): ProjectMargin {
  const quoted = parseFloat(String(quotedAmount))
  if (quoted <= 0) return { amount: 0, percentage: 0 }
  const amount = quoted - totalCost
  const percentage = (amount / quoted) * 100
  return { amount, percentage }
}

/**
 * Remaining advance balance after accounting for all amortizations.
 */
export function calculateAdvanceBalance(
  totalAdvances: number,
  totalAmortized: number
): number {
  return totalAdvances - totalAmortized
}

/**
 * Total budget from budget items.
 */
export function calculateTotalBudget(
  budgetItems: { total_price: string | number }[]
): number {
  return budgetItems.reduce(
    (sum, item) => sum + parseFloat(String(item.total_price)),
    0
  )
}

// ── Invoice Allocation Validation ────────────────────────────

export interface AllocationInput {
  amount: number | string
}

export interface AllocationValidation {
  valid: boolean
  allocated: number
  remaining: number
  isOver: boolean
}

/**
 * Validates that invoice allocations add up to (≤) the invoice total.
 * Allows 1 COP tolerance for rounding differences.
 */
export function validateAllocationTotal(
  allocations: AllocationInput[],
  invoiceTotal: number | string
): AllocationValidation {
  const total = parseFloat(String(invoiceTotal))
  const allocated = allocations.reduce(
    (sum, a) => sum + parseFloat(String(a.amount)),
    0
  )
  const remaining = total - allocated
  return {
    valid: Math.abs(remaining) <= 1,
    allocated,
    remaining,
    isOver: allocated > total + 1,
  }
}

// ── Invoice Alert ─────────────────────────────────────────────

/**
 * Returns true if an invoice has been pending allocation for more than
 * the threshold number of hours (default: 48h per Carolina's SLA).
 */
export function isInvoiceOverdue(
  createdAt: Date | string,
  hoursThreshold = 48
): boolean {
  const created =
    typeof createdAt === "string" ? new Date(createdAt) : createdAt
  const hoursElapsed =
    (Date.now() - created.getTime()) / (1000 * 60 * 60)
  return hoursElapsed > hoursThreshold
}

// ── Budget Progress ───────────────────────────────────────────

export function calculateBudgetProgress(
  totalCost: number,
  totalBudget: number
): number {
  if (totalBudget <= 0) return 0
  return Math.min((totalCost / totalBudget) * 100, 100)
}

// ── Margin Status Semaphore ───────────────────────────────────

export type MarginStatus = "green" | "amber" | "red"

/**
 * Returns a traffic-light status based on margin percentage.
 * Green > 15%, Amber 5–15%, Red < 5%
 */
export function getMarginStatus(marginPct: number): MarginStatus {
  if (marginPct > 15) return "green"
  if (marginPct >= 5) return "amber"
  return "red"
}

// ── Quote Totals ─────────────────────────────────────────────

export interface QuoteTotals {
  subtotal_amount: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  advance_amount: number
}

/**
 * Derives all monetary totals for a quote from its items and percentage inputs.
 *
 * Formula:
 *   discount = subtotal × (discountPct / 100)
 *   tax      = (subtotal − discount) × (taxPct / 100)
 *   total    = subtotal − discount + tax
 *   advance  = total × (advancePct / 100)
 */
export function calculateQuoteTotals(
  items: { total_price: string | number }[],
  discountPercentage: number | string,
  taxPercentage: number | string,
  advancePercentage: number | string
): QuoteTotals {
  const subtotal = items.reduce((s, i) => s + parseFloat(String(i.total_price)), 0)
  const discPct  = parseFloat(String(discountPercentage))
  const taxPct   = parseFloat(String(taxPercentage))
  const advPct   = parseFloat(String(advancePercentage))

  const discount = (subtotal * discPct) / 100
  const taxable  = subtotal - discount
  const tax      = (taxable * taxPct) / 100
  const total    = taxable + tax
  const advance  = (total * advPct) / 100

  return { subtotal_amount: subtotal, discount_amount: discount, tax_amount: tax, total_amount: total, advance_amount: advance }
}

// ── Cumulative Cut Progress ───────────────────────────────────

/**
 * Calculates cumulative project execution progress across approved cuts.
 * Returns a value 0–100.
 */
export function calculateCumulativeProgress(
  approvedCutsExecuted: (number | string)[],
  totalBudget: number | string
): number {
  const budget = parseFloat(String(totalBudget))
  if (budget <= 0) return 0
  const cumulative = approvedCutsExecuted.reduce<number>(
    (sum, v) => sum + parseFloat(String(v)),
    0
  )
  return Math.min((cumulative / budget) * 100, 100)
}
