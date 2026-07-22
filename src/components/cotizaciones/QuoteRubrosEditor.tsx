"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus, Trash2 } from "lucide-react"

export interface ActivityRow {
  description: string
  quantity: number
  unit_price: number
  amount: number
}

export interface RubroRow {
  rubro_type: string
  name: string
  budget_amount: number
  active: boolean
  sort_order: number
  activities: ActivityRow[]
  autoCalculate: boolean
}

const DEFAULT_RUBROS: RubroRow[] = [
  { rubro_type: "mano_obra",    name: "Mano de obra",          budget_amount: 0, active: true, sort_order: 0, activities: [], autoCalculate: false },
  { rubro_type: "materiales",   name: "Materiales",             budget_amount: 0, active: true, sort_order: 1, activities: [], autoCalculate: false },
  { rubro_type: "escombros",    name: "Escombros",              budget_amount: 0, active: true, sort_order: 2, activities: [], autoCalculate: false },
  { rubro_type: "acarreos",     name: "Acarreos / Transportes", budget_amount: 0, active: true, sort_order: 3, activities: [], autoCalculate: false },
  { rubro_type: "demoliciones", name: "Demoliciones",           budget_amount: 0, active: true, sort_order: 4, activities: [], autoCalculate: false },
  { rubro_type: "carpinteria",  name: "Carpintería",            budget_amount: 0, active: true, sort_order: 5, activities: [], autoCalculate: false },
  { rubro_type: "vidreria",     name: "Vidriería / Ventanería", budget_amount: 0, active: true, sort_order: 6, activities: [], autoCalculate: false },
  { rubro_type: "adicionales",  name: "Adicionales",            budget_amount: 0, active: true, sort_order: 7, activities: [], autoCalculate: false },
  { rubro_type: "imprevistos",  name: "Imprevistos",            budget_amount: 0, active: true, sort_order: 8, activities: [], autoCalculate: false },
]

const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 })

interface Props {
  value?: RubroRow[]
  onChange: (rubros: RubroRow[]) => void
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
        checked ? "bg-emerald-600" : "bg-muted-foreground/30"
      }`}
    >
      <span
        className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  )
}

export function QuoteRubrosEditor({ value, onChange }: Props) {
  const [rubros, setRubros] = useState<RubroRow[]>(() => {
    if (!value) return DEFAULT_RUBROS
    return value.map((r) => ({
      ...r,
      activities: r.activities ?? [],
      autoCalculate: r.autoCalculate ?? false,
    }))
  })

  const commit = (next: RubroRow[]) => {
    setRubros(next)
    onChange(next)
  }

  const update = (idx: number, patch: Partial<RubroRow>) => {
    commit(rubros.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  const addActivity = (rubroIdx: number) => {
    const next = rubros[rubroIdx].activities.concat({ description: "", quantity: 1, unit_price: 0, amount: 0 })
    update(rubroIdx, { activities: next })
  }

  const updateActivity = (rubroIdx: number, actIdx: number, patch: Partial<ActivityRow>) => {
    const rubro = rubros[rubroIdx]
    const nextActivities = rubro.activities.map((a, i) => (i === actIdx ? { ...a, ...patch } : a))
    const extra: Partial<RubroRow> = { activities: nextActivities }
    if (rubro.autoCalculate) {
      extra.budget_amount = nextActivities.reduce((s, a) => s + a.amount, 0)
    }
    update(rubroIdx, extra)
  }

  const removeActivity = (rubroIdx: number, actIdx: number) => {
    const rubro = rubros[rubroIdx]
    const nextActivities = rubro.activities.filter((_, i) => i !== actIdx)
    const extra: Partial<RubroRow> = { activities: nextActivities }
    if (rubro.autoCalculate) {
      extra.budget_amount = nextActivities.reduce((s, a) => s + a.amount, 0)
    }
    update(rubroIdx, extra)
  }

  const toggleAutoCalculate = (rubroIdx: number, checked: boolean) => {
    const rubro = rubros[rubroIdx]
    const extra: Partial<RubroRow> = { autoCalculate: checked }
    if (checked) {
      extra.budget_amount = rubro.activities.reduce((s, a) => s + a.amount, 0)
    }
    update(rubroIdx, extra)
  }

  const addPersonalizado = () => {
    commit([
      ...rubros,
      {
        rubro_type:    "personalizado",
        name:          "",
        budget_amount: 0,
        active:        true,
        sort_order:    rubros.length,
        activities:    [],
        autoCalculate: false,
      },
    ])
  }

  const remove = (idx: number) => {
    commit(rubros.filter((_, i) => i !== idx))
  }

  const total = rubros.filter((r) => r.active).reduce((s, r) => s + r.budget_amount, 0)

  return (
    <div className="space-y-3">
      {rubros.map((rubro, idx) => (
        <div
          key={`${rubro.rubro_type}-${idx}`}
          className={`rounded-xl border p-3 space-y-2.5 transition-opacity ${
            rubro.active ? "bg-card" : "bg-muted/30 opacity-60"
          }`}
        >
          {/* Toggle + name */}
          <div className="flex items-center gap-2.5">
            <Switch
              checked={rubro.active}
              onChange={(v) => update(idx, { active: v })}
            />
            <Input
              value={rubro.name}
              onChange={(e) => update(idx, { name: e.target.value })}
              placeholder="Nombre del rubro"
              className="h-8 text-sm flex-1 border-0 bg-transparent px-0 focus-visible:ring-0 font-medium"
              disabled={!rubro.active}
            />
            {rubro.rubro_type === "personalizado" && (
              <button
                type="button"
                onClick={() => remove(idx)}
                className="text-muted-foreground hover:text-destructive transition-colors p-1 -mr-1 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* autoCalculate toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rubro.autoCalculate}
              onChange={(e) => toggleAutoCalculate(idx, e.target.checked)}
              disabled={!rubro.active}
              className="rounded border-border text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
            />
            <span className="text-[11px] text-muted-foreground">Calcular total automáticamente</span>
          </label>

          {/* Budget amount */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
              $
            </span>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={rubro.budget_amount === 0 ? "" : String(rubro.budget_amount)}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "")
                update(idx, { budget_amount: parseInt(digits, 10) || 0 })
              }}
              placeholder={rubro.autoCalculate ? COP.format(rubro.budget_amount) : "0"}
              className="pl-7 tabular-nums h-9"
              disabled={!rubro.active}
              readOnly={rubro.autoCalculate}
            />
          </div>

          {/* Activities */}
          {rubro.active && (
            <div className="space-y-2 pt-0.5">
              {rubro.activities.map((act, aIdx) => (
                <div key={aIdx} className="rounded-lg border border-border/60 bg-muted/20 p-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Input
                      value={act.description}
                      onChange={(e) => updateActivity(idx, aIdx, { description: e.target.value })}
                      placeholder="Descripción de la actividad"
                      className="h-8 text-sm flex-1 min-w-0"
                    />
                    <button
                      type="button"
                      onClick={() => removeActivity(idx, aIdx)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      value={act.quantity === 0 ? "" : String(act.quantity)}
                      onChange={(e) => {
                        const q = parseFloat(e.target.value) || 0
                        updateActivity(idx, aIdx, { quantity: q, amount: q * act.unit_price })
                      }}
                      placeholder="Cant."
                      className="w-16 h-7 text-xs tabular-nums text-center shrink-0"
                    />
                    <span className="text-xs text-muted-foreground shrink-0">×</span>
                    <div className="relative flex-1 min-w-0">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">$</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={act.unit_price === 0 ? "" : String(act.unit_price)}
                        onChange={(e) => {
                          const up = parseInt(e.target.value.replace(/\D/g, ""), 10) || 0
                          updateActivity(idx, aIdx, { unit_price: up, amount: act.quantity * up })
                        }}
                        placeholder="Valor unit."
                        className="pl-6 h-7 text-xs tabular-nums"
                      />
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">=</span>
                    <span className="text-xs font-semibold tabular-nums text-foreground shrink-0 min-w-[56px] text-right">
                      {COP.format(act.amount)}
                    </span>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addActivity(idx)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar actividad
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Add personalizado */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-1.5 text-xs"
        onClick={addPersonalizado}
      >
        <Plus className="w-3.5 h-3.5" />
        Agregar rubro personalizado
      </Button>

      {/* Total */}
      <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3 border">
        <span className="text-sm font-medium text-muted-foreground">Total presupuestado</span>
        <span className="text-sm font-bold tabular-nums text-foreground">{COP.format(total)}</span>
      </div>
    </div>
  )
}
