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
  calculateQuoteTotals,
  calculateCumulativeProgress,
  getMarginStatus,
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

describe("calculateCumulativeProgress", () => {
  it("sums approved cuts and divides by budget", () => {
    // Cut 1: 2M executed, Cut 2: 3M executed — total 5M of 10M = 50%
    expect(calculateCumulativeProgress([2_000_000, 3_000_000], 10_000_000)).toBeCloseTo(50, 1)
  })

  it("caps at 100%", () => {
    expect(calculateCumulativeProgress([8_000_000, 5_000_000], 10_000_000)).toBe(100)
  })

  it("returns 0 with no cuts", () => {
    expect(calculateCumulativeProgress([], 10_000_000)).toBe(0)
  })

  it("returns 0 when budget is 0", () => {
    expect(calculateCumulativeProgress([1_000_000], 0)).toBe(0)
  })

  it("handles string inputs", () => {
    expect(calculateCumulativeProgress(["3000000"], "10000000")).toBeCloseTo(30, 1)
  })
})

describe("getMarginStatus", () => {
  it("returns green when margin > 15%", () => {
    expect(getMarginStatus(20)).toBe("green")
    expect(getMarginStatus(15.1)).toBe("green")
  })

  it("returns amber when margin is between 5% and 15% inclusive", () => {
    expect(getMarginStatus(15)).toBe("amber")
    expect(getMarginStatus(10)).toBe("amber")
    expect(getMarginStatus(5)).toBe("amber")
  })

  it("returns red when margin < 5%", () => {
    expect(getMarginStatus(4.9)).toBe("red")
    expect(getMarginStatus(0)).toBe("red")
    expect(getMarginStatus(-10)).toBe("red")
  })
})

describe("calculateQuoteTotals", () => {
  const items = [
    { total_price: "5000000" },
    { total_price: "3000000" },
  ] // subtotal = 8_000_000

  it("no discount, no tax", () => {
    const r = calculateQuoteTotals(items, 0, 0, 50)
    expect(r.subtotal_amount).toBe(8_000_000)
    expect(r.discount_amount).toBe(0)
    expect(r.tax_amount).toBe(0)
    expect(r.total_amount).toBe(8_000_000)
    expect(r.advance_amount).toBe(4_000_000)
  })

  it("10% discount, 0% tax", () => {
    const r = calculateQuoteTotals(items, 10, 0, 50)
    expect(r.discount_amount).toBe(800_000)
    expect(r.tax_amount).toBe(0)
    expect(r.total_amount).toBe(7_200_000)
  })

  it("0% discount, 19% IVA", () => {
    const r = calculateQuoteTotals(items, 0, 19, 50)
    expect(r.discount_amount).toBe(0)
    expect(r.tax_amount).toBeCloseTo(1_520_000)
    expect(r.total_amount).toBeCloseTo(9_520_000)
  })

  it("10% discount + 19% IVA combined", () => {
    const r = calculateQuoteTotals(items, 10, 19, 50)
    // taxable = 8_000_000 - 800_000 = 7_200_000
    // tax = 7_200_000 * 0.19 = 1_368_000
    // total = 7_200_000 + 1_368_000 = 8_568_000
    expect(r.discount_amount).toBe(800_000)
    expect(r.tax_amount).toBeCloseTo(1_368_000)
    expect(r.total_amount).toBeCloseTo(8_568_000)
  })

  it("accepts string percentages (numeric column values from DB)", () => {
    const r = calculateQuoteTotals(items, "10.00", "19.00", "50.00")
    expect(r.discount_amount).toBe(800_000)
    expect(r.tax_amount).toBeCloseTo(1_368_000)
  })

  it("empty items list returns zeros", () => {
    const r = calculateQuoteTotals([], 0, 19, 50)
    expect(r.subtotal_amount).toBe(0)
    expect(r.total_amount).toBe(0)
    expect(r.advance_amount).toBe(0)
  })
})
