"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Plus, Trash2, ChevronDown } from "lucide-react"
import { formatCOP } from "@/lib/utils"
import { calculateQuoteTotals } from "@/lib/calculations"

const CATEGORIES = [
  { value: "mano_obra",   label: "Mano de obra" },
  { value: "materiales",  label: "Materiales" },
  { value: "equipos",     label: "Equipos" },
  { value: "imprevistos", label: "Imprevistos" },
  { value: "otro",        label: "Otro" },
]

const UNITS = ["m²", "ml", "m³", "gl", "un", "hr", "kg", "ton", "viaje", "lb"]

type Category = "mano_obra" | "materiales" | "equipos" | "imprevistos" | "otro"

interface QuoteItem {
  id: string
  name: string
  category: string
  unit: string
  quantity: string
  unit_price: string
  total_price: string
}

interface Props {
  quoteId: string
  initialItems: QuoteItem[]
  discountPercentage: string
  taxPercentage: string
  advancePercentage: string
  readonly?: boolean
}

export function QuoteItemsEditor({
  quoteId,
  initialItems,
  discountPercentage,
  taxPercentage,
  advancePercentage,
  readonly = false,
}: Props) {
  const router = useRouter()
  const [items, setItems] = useState<QuoteItem[]>(initialItems)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: "",
    category: "mano_obra" as Category,
    unit: "m²",
    quantity: "",
    unit_price: "",
  })

  const unitPrice     = parseFloat(form.unit_price) || 0
  const quantity      = parseFloat(form.quantity) || 0
  const previewTotal  = quantity * unitPrice

  const totals = calculateQuoteTotals(items, discountPercentage, taxPercentage, advancePercentage)

  const handleAdd = async () => {
    setError(null)
    if (!form.name.trim() || !form.quantity || !form.unit_price) {
      setError("Completa todos los campos")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/cotizaciones/${quoteId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const json = await res.json() as { success: boolean; error?: string; data?: QuoteItem }
      if (!json.success) throw new Error(json.error ?? "Error")
      setItems((prev) => [...prev, json.data!])
      setForm({ name: "", category: "mano_obra", unit: "m²", quantity: "", unit_price: "" })
      setShowForm(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (itemId: string) => {
    setDeleting(itemId)
    try {
      const res = await fetch(`/api/cotizaciones/${quoteId}/items/${itemId}`, { method: "DELETE" })
      const json = await res.json() as { success: boolean }
      if (!json.success) return
      setItems((prev) => prev.filter((i) => i.id !== itemId))
      router.refresh()
    } finally {
      setDeleting(null)
    }
  }

  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    items: items.filter((i) => i.category === cat.value),
  })).filter((g) => g.items.length > 0)

  const hasDiscount = parseFloat(discountPercentage) > 0
  const hasTax      = parseFloat(taxPercentage) > 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Actividades
        </h3>
        {!readonly && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-primary"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? <ChevronDown className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showForm ? "Cerrar" : "Agregar"}
          </Button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Actividad *</Label>
            <Input
              placeholder="Ej. Instalación de piso"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Categoría</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v as Category }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Unidad</Label>
              <Select
                value={form.unit}
                onValueChange={(v) => setForm((f) => ({ ...f, unit: v }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Cantidad *</Label>
              <Input
                type="number"
                min={0}
                step="any"
                placeholder="0"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                className="tabular-nums"
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor unitario (COP) *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="0"
                  value={form.unit_price}
                  onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))}
                  className="pl-6 tabular-nums"
                  inputMode="numeric"
                />
              </div>
            </div>
          </div>

          {previewTotal > 0 && (
            <p className="text-xs text-muted-foreground tabular-nums">
              Total: <span className="font-semibold text-foreground">{formatCOP(previewTotal)}</span>
            </p>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button className="w-full" size="sm" onClick={handleAdd} disabled={submitting}>
            {submitting ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Guardando...</> : "Guardar actividad"}
          </Button>
        </div>
      )}

      {/* Items grouped by category */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">Sin actividades</p>
          {!readonly && <p className="text-xs text-muted-foreground mt-1">Agrega las actividades a cotizar</p>}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {grouped.map((group, gi) => (
            <div key={group.value} className={gi > 0 ? "border-t border-border" : ""}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-3 pt-3 pb-1">
                {group.label}
              </p>
              {group.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {parseFloat(item.quantity).toLocaleString("es-CO")} {item.unit} ×{" "}
                      {formatCOP(parseFloat(item.unit_price))}
                    </p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums shrink-0">
                    {formatCOP(parseFloat(item.total_price))}
                  </p>
                  {!readonly && (
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deleting === item.id}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    >
                      {deleting === item.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}

          {/* Totals block */}
          <div className="border-t border-border bg-muted/20 divide-y divide-border/60">
            <div className="flex justify-between items-center px-3 py-2">
              <span className="text-xs text-muted-foreground">Subtotal</span>
              <span className="text-sm tabular-nums">{formatCOP(totals.subtotal_amount)}</span>
            </div>
            {hasDiscount && (
              <div className="flex justify-between items-center px-3 py-2">
                <span className="text-xs text-muted-foreground">Descuento ({discountPercentage}%)</span>
                <span className="text-sm tabular-nums text-destructive">−{formatCOP(totals.discount_amount)}</span>
              </div>
            )}
            {hasTax && (
              <div className="flex justify-between items-center px-3 py-2">
                <span className="text-xs text-muted-foreground">IVA ({taxPercentage}%)</span>
                <span className="text-sm tabular-nums">+{formatCOP(totals.tax_amount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center px-3 py-3 bg-muted/30">
              <span className="text-sm font-bold">Total</span>
              <span className="text-base font-bold tabular-nums">{formatCOP(totals.total_amount)}</span>
            </div>
            {totals.advance_amount > 0 && (
              <div className="flex justify-between items-center px-3 py-2">
                <span className="text-xs text-muted-foreground">Anticipo ({advancePercentage}%)</span>
                <span className="text-sm tabular-nums font-medium">{formatCOP(totals.advance_amount)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
