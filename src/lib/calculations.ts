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
