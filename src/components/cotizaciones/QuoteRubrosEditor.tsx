"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus, Trash2 } from "lucide-react"

export interface RubroRow {
  rubro_type: string
  name: string
  budget_amount: number
  active: boolean
  sort_order: number
}

const DEFAULT_RUBROS: RubroRow[] = [
  { rubro_type: "mano_obra",    name: "Mano de obra",          budget_amount: 0, active: true, sort_order: 0 },
  { rubro_type: "materiales",   name: "Materiales",             budget_amount: 0, active: true, sort_order: 1 },
  { rubro_type: "escombros",    name: "Escombros",              budget_amount: 0, active: true, sort_order: 2 },
  { rubro_type: "acarreos",     name: "Acarreos / Transportes", budget_amount: 0, active: true, sort_order: 3 },
  { rubro_type: "demoliciones", name: "Demoliciones",           budget_amount: 0, active: true, sort_order: 4 },
  { rubro_type: "carpinteria",  name: "Carpintería",            budget_amount: 0, active: true, sort_order: 5 },
  { rubro_type: "vidreria",     name: "Vidriería / Ventanería", budget_amount: 0, active: true, sort_order: 6 },
  { rubro_type: "adicionales",  name: "Adicionales",            budget_amount: 0, active: true, sort_order: 7 },
  { rubro_type: "imprevistos",  name: "Imprevistos",            budget_amount: 0, active: true, sort_order: 8 },
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
  const [rubros, setRubros] = useState<RubroRow[]>(value ?? DEFAULT_RUBROS)

  const update = (idx: number, patch: Partial<RubroRow>) => {
    const next = rubros.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    setRubros(next)
    onChange(next)
  }

  const addPersonalizado = () => {
    const next = [
      ...rubros,
      {
        rubro_type:    "personalizado",
        name:          "",
        budget_amount: 0,
        active:        true,
        sort_order:    rubros.length,
      },
    ]
    setRubros(next)
    onChange(next)
  }

  const remove = (idx: number) => {
    const next = rubros.filter((_, i) => i !== idx)
    setRubros(next)
    onChange(next)
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
          {/* Row header: toggle + name */}
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

          {/* Budget amount */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
              $
            </span>
            <Input
              type="number"
              min={0}
              step={10000}
              value={rubro.budget_amount === 0 ? "" : rubro.budget_amount}
              onChange={(e) =>
                update(idx, { budget_amount: parseFloat(e.target.value) || 0 })
              }
              placeholder="0"
              className="pl-7 tabular-nums h-9"
              disabled={!rubro.active}
              inputMode="numeric"
            />
          </div>
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
