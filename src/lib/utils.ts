import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Currency ─────────────────────────────────────────────────

export function formatCOP(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "$0"
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  if (isNaN(num)) return "$0"
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

export function parseCOP(value: string | number): number {
  if (typeof value === "number") return value
  return parseFloat(value.replace(/[^0-9.-]/g, "")) || 0
}

// ── Dates ────────────────────────────────────────────────────

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d)
}

export function formatDateLong(date: Date | string | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d)
}

export function getHoursAgo(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : date
  return (Date.now() - d.getTime()) / (1000 * 60 * 60)
}

export function formatHoursAgo(date: Date | string): string {
  const hours = getHoursAgo(date)
  if (hours < 1) return "hace menos de 1 hora"
  if (hours < 24) return `hace ${Math.floor(hours)}h`
  const days = Math.floor(hours / 24)
  return `hace ${days} día${days !== 1 ? "s" : ""}`
}

// ── Percentages ──────────────────────────────────────────────

export function formatPercentage(
  value: number | string | null | undefined,
  decimals = 1
): string {
  if (value === null || value === undefined) return "0%"
  const num = typeof value === "string" ? parseFloat(value) : value
  return `${num.toFixed(decimals)}%`
}

// ── Miscellaneous ─────────────────────────────────────────────

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + "…"
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}
