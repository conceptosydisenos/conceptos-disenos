import { describe, it, expect } from "vitest"
import {
  calculateExecutedAmount,
  calculateAmortization,
  calculateNetToPay,
  calculateProjectMargin,
  calculateAdvanceBalance,
  validateAllocationTotal,
  isInvoiceOverdue,
  calculateBudgetProgress,
} from "../src/lib/calculations"

describe("calculateExecutedAmount", () => {
  it("calculates correctly with full progress", () => {
    const items = [{ id: "a", total_price: "1000000" }]
    const progress = [{ budget_item_id: "a", progress_percentage: "100" }]
    expect(calculateExecutedAmount(items, progress)).toBe(1000000)
  })

  it("calculates partial progress", () => {
    const items = [{ id: "a", total_price: "1000000" }]
    const progress = [{ budget_item_id: "a", progress_percentage: "60" }]
    expect(calculateExecutedAmount(items, progress)).toBe(600000)
  })

  it("sums multiple items", () => {
    const items = [
      { id: "a", total_price: "500000" },
      { id: "b", total_price: "500000" },
    ]
    const progress = [
      { budget_item_id: "a", progress_percentage: "100" },
      { budget_item_id: "b", progress_percentage: "50" },
    ]
    expect(calculateExecutedAmount(items, progress)).toBe(750000)
  })

  it("returns 0 for missing items in progress map", () => {
    const items = [{ id: "a", total_price: "1000000" }]
    expect(calculateExecutedAmount(items, [])).toBe(0)
  })
})

describe("calculateAmortization", () => {
  it("amortizes 50% advance correctly", () => {
    expect(calculateAmortization(1_000_000, 50)).toBe(500_000)
  })

  it("handles 0% advance", () => {
    expect(calculateAmortization(1_000_000, 0)).toBe(0)
  })

  it("handles 100% advance", () => {
    expect(calculateAmortization(1_000_000, 100)).toBe(1_000_000)
  })

  it("handles string input", () => {
    expect(calculateAmortization(2_000_000, "50.00")).toBe(1_000_000)
  })
})

describe("calculateNetToPay", () => {
  it("subtracts amortization from executed", () => {
    expect(calculateNetToPay(1_000_000, 500_000)).toBe(500_000)
  })

  it("returns 0 when amortization equals executed", () => {
    expect(calculateNetToPay(1_000_000, 1_000_000)).toBe(0)
  })
})

describe("calculateProjectMargin", () => {
  it("calculates positive margin", () => {
    const result = calculateProjectMargin(10_000_000, 7_000_000)
    expect(result.amount).toBe(3_000_000)
    expect(result.percentage).toBeCloseTo(30, 1)
  })

  it("calculates negative margin (loss)", () => {
    const result = calculateProjectMargin(10_000_000, 12_000_000)
    expect(result.amount).toBe(-2_000_000)
    expect(result.percentage).toBeCloseTo(-20, 1)
  })

  it("returns 0 when quoted is 0", () => {
    const result = calculateProjectMargin(0, 1_000_000)
    expect(result.amount).toBe(0)
    expect(result.percentage).toBe(0)
  })
})

describe("validateAllocationTotal", () => {
  it("validates exact allocation", () => {
    const result = validateAllocationTotal(
      [{ amount: 300_000 }, { amount: 700_000 }],
      1_000_000
    )
    expect(result.valid).toBe(true)
    expect(result.remaining).toBeCloseTo(0)
  })

  it("rejects over-allocation", () => {
    const result = validateAllocationTotal(
      [{ amount: 600_000 }, { amount: 600_000 }],
      1_000_000
    )
    expect(result.isOver).toBe(true)
    expect(result.valid).toBe(false)
  })

  it("allows 1 COP rounding tolerance", () => {
    const result = validateAllocationTotal([{ amount: 999_999 }], 1_000_000)
    expect(result.valid).toBe(true)
  })
})

describe("isInvoiceOverdue", () => {
  it("returns false for recent invoice", () => {
    const recent = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24h ago
    expect(isInvoiceOverdue(recent, 48)).toBe(false)
  })

  it("returns true for invoice older than threshold", () => {
    const old = new Date(Date.now() - 72 * 60 * 60 * 1000) // 72h ago
    expect(isInvoiceOverdue(old, 48)).toBe(true)
  })

  it("handles string dates", () => {
    const old = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
    expect(isInvoiceOverdue(old, 48)).toBe(true)
  })
})

describe("calculateBudgetProgress", () => {
  it("calculates percentage used", () => {
    expect(calculateBudgetProgress(3_000_000, 10_000_000)).toBeCloseTo(30, 1)
  })

  it("caps at 100% when over budget", () => {
    expect(calculateBudgetProgress(12_000_000, 10_000_000)).toBe(100)
  })

  it("returns 0 for zero budget", () => {
    expect(calculateBudgetProgress(1_000_000, 0)).toBe(0)
  })
})
