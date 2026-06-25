"use client"

import { useState, useCallback } from "react"
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
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react"
import type { Project } from "@/types"

interface ProjectRubro {
  id: string
  rubro_type: string
  name: string
}

interface AllocationRow {
  id: string
  project_id: string
  amount: string
  percentage: string
  category: "materiales" | "equipos" | "otro"
  project_rubro_id: string | null
}

interface AllocationFormProps {
  invoiceId: string
  invoiceTotal: number
  projects: Pick<Project, "id" | "name" | "status">[]
  rubrosByProject?: Record<string, ProjectRubro[]>
}

function newRow(): AllocationRow {
  return {
    id: Math.random().toString(36).slice(2),
    project_id: "",
    amount: "",
    percentage: "",
    category: "materiales",
    project_rubro_id: null,
  }
}

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
})

export function AllocationForm({
  invoiceId,
  invoiceTotal,
  projects,
  rubrosByProject = {},
}: AllocationFormProps) {
  const router = useRouter()
  const [rows, setRows] = useState<AllocationRow[]>([newRow()])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allocatedTotal = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
  const remaining = invoiceTotal - allocatedTotal
  const percentage = invoiceTotal > 0 ? Math.min(100, (allocatedTotal / invoiceTotal) * 100) : 0
  const isComplete = Math.abs(remaining) <= 1 // 1 COP rounding tolerance
  const isOver = allocatedTotal > invoiceTotal + 1

  const updateAmount = useCallback(
    (id: string, rawAmount: string) => {
      const amount = parseFloat(rawAmount) || 0
      const pct = invoiceTotal > 0 ? ((amount / invoiceTotal) * 100).toFixed(2) : "0"
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, amount: rawAmount, percentage: pct } : r))
      )
    },
    [invoiceTotal]
  )

  const updatePercentage = useCallback(
    (id: string, rawPct: string) => {
      const pct = parseFloat(rawPct) || 0
      const amount = ((pct / 100) * invoiceTotal).toFixed(0)
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, percentage: rawPct, amount } : r))
      )
    },
    [invoiceTotal]
  )

  const fillRemaining = useCallback(
    (id: string) => {
      const otherTotal = rows
        .filter((r) => r.id !== id)
        .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
      const rem = invoiceTotal - otherTotal
      if (rem > 0) updateAmount(id, rem.toFixed(0))
    },
    [rows, invoiceTotal, updateAmount]
  )

  const handleSubmit = async () => {
    if (!isComplete || isOver) return
    const invalid = rows.find((r) => !r.project_id || !parseFloat(r.amount))
    if (invalid) { setError("Todos los campos son requeridos"); return }

    // Check that rows with available rubros have a rubro selected
    const missingRubro = rows.find((r) => {
      const rubros = rubrosByProject[r.project_id] ?? []
      return rubros.length > 0 && !r.project_rubro_id
    })
    if (missingRubro) {
      setError("Selecciona el rubro para cada proyecto")
      return
    }

    setSubmitting(true)
    setError(null)

    const allocations = rows.map((r) => ({
      project_id:       r.project_id,
      amount:           parseFloat(r.amount),
      percentage:       parseFloat(r.percentage),
      category:         r.category,
      project_rubro_id: r.project_rubro_id ?? null,
    }))

    try {
      const res = await fetch(`/api/facturas/${invoiceId}/asignar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocations }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      router.push(`/dashboard/facturas/${invoiceId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al asignar")
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total asignado</span>
          <span className={`font-bold tabular-nums ${isOver ? "text-destructive" : isComplete ? "text-green-600" : "text-foreground"}`}>
            {COP.format(allocatedTotal)} / {COP.format(invoiceTotal)}
          </span>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${isOver ? "bg-destructive" : isComplete ? "bg-green-500" : "bg-primary"}`}
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{percentage.toFixed(1)}% asignado</span>
          {!isComplete && !isOver && (
            <span className="text-xs text-emerald-700 font-medium">
              Faltan {COP.format(Math.abs(remaining))}
            </span>
          )}
          {isComplete && (
            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              100% asignado
            </span>
          )}
          {isOver && (
            <span className="text-xs text-destructive font-medium flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Excede el total
            </span>
          )}
        </div>
      </div>

      {/* Allocation rows */}
      <div className="space-y-3">
        {rows.map((row, index) => {
          const projectRubros = row.project_id ? (rubrosByProject[row.project_id] ?? []) : []

          return (
            <div key={row.id} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Asignación {index + 1}
                </span>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1 -m-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Project selector */}
              <div className="space-y-1.5">
                <Label className="text-xs">Proyecto *</Label>
                <Select
                  value={row.project_id}
                  onValueChange={(val) =>
                    setRows((prev) =>
                      prev.map((r) =>
                        r.id === row.id
                          ? { ...r, project_id: val, project_rubro_id: null }
                          : r
                      )
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar proyecto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-2">
                          {p.name}
                          {p.status !== "active" && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {p.status}
                            </Badge>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Rubro selector — only shown when project has rubros */}
              {projectRubros.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Rubro *</Label>
                  <Select
                    value={row.project_rubro_id ?? ""}
                    onValueChange={(val) =>
                      setRows((prev) =>
                        prev.map((r) =>
                          r.id === row.id ? { ...r, project_rubro_id: val } : r
                        )
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar rubro..." />
                    </SelectTrigger>
                    <SelectContent>
                      {projectRubros.map((rubro) => (
                        <SelectItem key={rubro.id} value={rubro.id}>
                          {rubro.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Amount + percentage bidirectional */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Monto (COP) *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      placeholder="0"
                      value={row.amount}
                      onChange={(e) => updateAmount(row.id, e.target.value)}
                      className="pl-7 tabular-nums"
                      inputMode="numeric"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Porcentaje</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      placeholder="0"
                      value={row.percentage}
                      onChange={(e) => updatePercentage(row.id, e.target.value)}
                      className="pr-7 tabular-nums"
                      inputMode="decimal"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              </div>

              {/* Categoría + fill remaining */}
              <div className="flex items-end gap-3">
                <div className="space-y-1.5 flex-1">
                  <Label className="text-xs">Categoría</Label>
                  <Select
                    value={row.category}
                    onValueChange={(val) =>
                      setRows((prev) =>
                        prev.map((r) =>
                          r.id === row.id ? { ...r, category: val as AllocationRow["category"] } : r
                        )
                      )
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="materiales">Materiales</SelectItem>
                      <SelectItem value="equipos">Equipos</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {rows.length > 1 && !isComplete && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs shrink-0"
                    onClick={() => fillRemaining(row.id)}
                  >
                    Llenar resto
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add row */}
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={() => setRows((prev) => [...prev, newRow()])}
        disabled={rows.length >= projects.length}
      >
        <Plus className="w-4 h-4" />
        Agregar proyecto
      </Button>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Confirm */}
      <Button
        className="w-full"
        disabled={!isComplete || isOver || submitting}
        onClick={handleSubmit}
      >
        {submitting ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</>
        ) : (
          "Confirmar asignación"
        )}
      </Button>

      {!isComplete && (
        <p className="text-xs text-center text-muted-foreground">
          El botón se habilita cuando el 100% esté asignado
        </p>
      )}
    </div>
  )
}
