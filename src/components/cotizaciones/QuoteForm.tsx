"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { QuoteRubrosEditor, type RubroRow } from "@/components/cotizaciones/QuoteRubrosEditor"

interface InitialValues {
  project_name?: string
  contact_name?: string
  contact_phone?: string
  contact_email?: string
  lead_id?: string
  description?: string
  valid_until?: string
  discount_percentage?: number
  tax_percentage?: number
  advance_percentage?: number
  contingency_percentage?: number
  rubros?: RubroRow[]
}

interface Props {
  initialValues?: InitialValues
  quoteId?: string
  existingActivityItemIds?: string[]
}

function defaultValidUntil() {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().split("T")[0]
}

export function QuoteForm({ initialValues, quoteId, existingActivityItemIds }: Props) {
  const router = useRouter()
  const isEditMode = Boolean(quoteId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rubros, setRubros] = useState<RubroRow[]>(initialValues?.rubros ?? [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const data = new FormData(e.currentTarget)

    const body = {
      project_name:           data.get("project_name"),
      description:            data.get("description") || undefined,
      lead_id:                initialValues?.lead_id || undefined,
      contact_name:           data.get("contact_name") || undefined,
      contact_phone:          data.get("contact_phone") || undefined,
      contact_email:          data.get("contact_email") || undefined,
      valid_until:            data.get("valid_until"),
      discount_percentage:    Number(data.get("discount_percentage") ?? 0),
      tax_percentage:         Number(data.get("tax_percentage") ?? 0),
      advance_percentage:     Number(data.get("advance_percentage") ?? 50),
      contingency_percentage: isEditMode
        ? (initialValues?.contingency_percentage ?? 0)
        : Number(data.get("contingency_percentage") ?? 0),
    }

    try {
      if (isEditMode && quoteId) {
        // ── Edit mode ──────────────────────────────────────────
        const res = await fetch(`/api/cotizaciones/${quoteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const json = await res.json() as { success: boolean; error?: string }
        if (!json.success) {
          setError(json.error ?? "Error al guardar")
          setSaving(false)
          return
        }

        if (rubros.length > 0) {
          // Delete existing activity items FIRST so the rubros DELETE (inside
          // the rubros PATCH) is not blocked by the FK constraint on quote_rubro_id.
          if (existingActivityItemIds && existingActivityItemIds.length > 0) {
            await Promise.all(
              existingActivityItemIds.map((itemId) =>
                fetch(`/api/cotizaciones/${quoteId}/items/${itemId}`, { method: "DELETE" })
              )
            )
          }

          const rubrosRes = await fetch(`/api/cotizaciones/${quoteId}/rubros`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rubros }),
          })
          const rubrosJson = await rubrosRes.json() as {
            success: boolean
            data?: Array<{ id: string; rubro_type: string; sort_order: number }>
            error?: string
          }

          if (!rubrosJson.success) {
            setError(rubrosJson.error ?? "Error al guardar los rubros")
            setSaving(false)
            return
          }

          if (rubrosJson.data) {
            // Map by sort_order (not rubro_type) so multiple "personalizado"
            // rubros each resolve to their correct DB id.
            const rubroIdMap = new Map(rubrosJson.data.map((r) => [r.sort_order, r.id]))
            const activitySaves = rubros.flatMap((rubro) => {
              if (!rubro.active) return []
              const rubroId = rubroIdMap.get(rubro.sort_order)
              if (!rubroId) return []
              return (rubro.activities ?? [])
                .filter((a) => a.description.trim().length > 0 && a.amount > 0)
                .map((a) =>
                  fetch(`/api/cotizaciones/${quoteId}/items`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      category:       rubro.rubro_type,
                      name:           a.description.trim(),
                      unit:           "Global",
                      quantity:       a.quantity,
                      unit_price:     a.unit_price,
                      quote_rubro_id: rubroId,
                    }),
                  })
                )
            })
            await Promise.all(activitySaves)
          }
        }

        router.push(`/dashboard/cotizaciones/${quoteId}`)
        router.refresh()
      } else {
        // ── Create mode ────────────────────────────────────────
        const res = await fetch("/api/cotizaciones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const json = await res.json() as { success: boolean; error?: string; data?: { id: string } }

        if (!json.success || !json.data) {
          setError(json.error ?? "Error al guardar")
          setSaving(false)
          return
        }

        const newQuoteId = json.data.id

        // Save rubros + activities
        if (rubros.length > 0) {
          const rubrosRes = await fetch(`/api/cotizaciones/${newQuoteId}/rubros`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rubros }),
          })
          const rubrosJson = await rubrosRes.json() as {
            success: boolean
            data?: Array<{ id: string; rubro_type: string; sort_order: number }>
            error?: string
          }

          if (rubrosJson.success && rubrosJson.data) {
            const rubroIdMap = new Map(rubrosJson.data.map((r) => [r.sort_order, r.id]))
            const activitySaves = rubros.flatMap((rubro) => {
              if (!rubro.active) return []
              const rubroId = rubroIdMap.get(rubro.sort_order)
              if (!rubroId) return []
              return (rubro.activities ?? [])
                .filter((a) => a.description.trim().length > 0 && a.amount > 0)
                .map((a) =>
                  fetch(`/api/cotizaciones/${newQuoteId}/items`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      category:       rubro.rubro_type,
                      name:           a.description.trim(),
                      unit:           "Global",
                      quantity:       a.quantity,
                      unit_price:     a.unit_price,
                      quote_rubro_id: rubroId,
                    }),
                  })
                )
            })
            await Promise.all(activitySaves)
          }
        }

        router.push(`/dashboard/cotizaciones/${newQuoteId}`)
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de conexión")
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Proyecto */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Proyecto</p>
        <div>
          <Label htmlFor="project_name">Nombre del proyecto *</Label>
          <Input
            id="project_name"
            name="project_name"
            required
            defaultValue={initialValues?.project_name ?? ""}
            placeholder="Ej. Remodelación cocina y baños"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="description">
            Descripción <span className="text-muted-foreground font-normal">(opcional)</span>
          </Label>
          <Textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={initialValues?.description ?? ""}
            placeholder="Alcance del trabajo, materiales incluidos, exclusiones..."
            className="mt-1.5 resize-none"
          />
        </div>
      </div>

      {/* Contacto */}
      <div className="space-y-4 pt-2 border-t border-border">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contacto</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="contact_name">Nombre</Label>
            <Input
              id="contact_name"
              name="contact_name"
              defaultValue={initialValues?.contact_name ?? ""}
              placeholder="Cliente o empresa"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="contact_phone">Teléfono</Label>
            <Input
              id="contact_phone"
              name="contact_phone"
              type="tel"
              defaultValue={initialValues?.contact_phone ?? ""}
              placeholder="300 123 4567"
              className="mt-1.5"
              inputMode="tel"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="contact_email">Email</Label>
          <Input
            id="contact_email"
            name="contact_email"
            type="email"
            defaultValue={initialValues?.contact_email ?? ""}
            placeholder="correo@ejemplo.com"
            className="mt-1.5"
          />
        </div>
      </div>

      {/* Condiciones */}
      <div className="space-y-4 pt-2 border-t border-border">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Condiciones</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="valid_until">Válida hasta *</Label>
            <Input
              id="valid_until"
              name="valid_until"
              type="date"
              required
              defaultValue={initialValues?.valid_until ?? defaultValidUntil()}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="advance_percentage">Anticipo (%)</Label>
            <Input
              id="advance_percentage"
              name="advance_percentage"
              type="number"
              min={0}
              max={100}
              step={1}
              defaultValue={initialValues?.advance_percentage ?? 50}
              className="mt-1.5 tabular-nums"
              inputMode="numeric"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="discount_percentage">Descuento (%)</Label>
            <Input
              id="discount_percentage"
              name="discount_percentage"
              type="number"
              min={0}
              max={100}
              step={0.1}
              defaultValue={initialValues?.discount_percentage ?? 0}
              className="mt-1.5 tabular-nums"
              inputMode="decimal"
            />
          </div>
          <div>
            <Label htmlFor="tax_percentage">IVA (%)</Label>
            <Input
              id="tax_percentage"
              name="tax_percentage"
              type="number"
              min={0}
              max={100}
              step={1}
              defaultValue={initialValues?.tax_percentage ?? 0}
              placeholder="Ej. 19"
              className="mt-1.5 tabular-nums"
              inputMode="numeric"
            />
          </div>
        </div>
      </div>

      {/* Rubros y presupuesto */}
      <div className="space-y-3 pt-2 border-t border-border">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Rubros y presupuesto
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Activa los rubros que aplican y asigna el presupuesto estimado para cada uno.
          </p>
        </div>
        <QuoteRubrosEditor value={initialValues?.rubros} onChange={setRubros} />
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving} className="flex-1">
          {saving
            ? (isEditMode ? "Guardando..." : "Creando...")
            : (isEditMode ? "Guardar cambios" : "Crear cotización")
          }
        </Button>
      </div>
    </form>
  )
}
