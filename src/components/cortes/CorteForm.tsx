"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ActivityProgressInput } from "@/components/cortes/ActivityProgressInput"
import { CorteSummary } from "@/components/cortes/CorteSummary"
import { Loader2, AlertTriangle } from "lucide-react"
import {
  calculateExecutedAmount,
  calculateCumulativeProgress,
} from "@/lib/calculations"

export interface BudgetItemWithContext {
  id: string
  name: string
  unit: string
  category: string
  total_price: string
  previous_progress_pct: number
}

interface CorteFormProps {
  projectId: string
  cutNumber: number
  advancePercentage: number
  quotedAmount: number
  budgetItems: BudgetItemWithContext[]
  previouslyExecuted: number // sum of all approved cuts' total_executed
}

export function CorteForm({
  projectId,
  cutNumber,
  advancePercentage,
  quotedAmount,
  budgetItems,
  previouslyExecuted,
}: CorteFormProps) {
  const router = useRouter()
  const [cutDate, setCutDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState("")
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleProgressChange = (id: string, pct: number) => {
    setProgress((prev) => ({ ...prev, [id]: pct }))
  }

  // Live calculations
  const progressEntries = Object.entries(progress)
    .filter(([, pct]) => pct > 0)
    .map(([budget_item_id, pct]) => ({ budget_item_id, progress_percentage: pct }))

  const totalExecuted = calculateExecutedAmount(
    budgetItems.map((b) => ({ id: b.id, total_price: b.total_price })),
    progressEntries
  )

  const cumulativeProgress = calculateCumulativeProgress(
    [previouslyExecuted + totalExecuted],
    quotedAmount
  )

  // Group items by category for readability
  const grouped = budgetItems.reduce<Record<string, BudgetItemWithContext[]>>((acc, item) => {
    const group = acc[item.category] ?? []
    return { ...acc, [item.category]: [...group, item] }
  }, {})

  const CATEGORY_LABELS: Record<string, string> = {
    materiales: "Materiales",
    mano_obra: "Mano de obra",
    equipos: "Equipos",
    imprevistos: "Imprevistos",
    otro: "Otro",
  }

  const hasAnyProgress = progressEntries.length > 0

  const handleSubmit = async () => {
    if (!hasAnyProgress) {
      setError("Registra el avance en al menos una actividad.")
      return
    }
    setSubmitting(true)
    setError(null)

    const items = budgetItems
      .map((b) => ({ budget_item_id: b.id, progress_percentage: progress[b.id] ?? 0 }))
      .filter((i) => i.progress_percentage > 0)

    try {
      const res = await fetch("/api/cortes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, cut_date: cutDate, notes, items }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      router.push(`/dashboard/proyectos/${projectId}/cortes/${json.data.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el corte")
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Date + notes */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="cut-date">Fecha del corte</Label>
          <Input
            id="cut-date"
            type="date"
            value={cutDate}
            onChange={(e) => setCutDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cut-notes">Observaciones (opcional)</Label>
          <Textarea
            id="cut-notes"
            rows={2}
            placeholder="Notas sobre el avance de esta semana..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      {/* Live summary — pinned above items on mobile */}
      {hasAnyProgress && (
        <CorteSummary
          totalExecuted={totalExecuted}
          advancePercentage={advancePercentage}
          quotedAmount={quotedAmount}
          cumulativeProgress={cumulativeProgress}
        />
      )}

      {/* Activities by category */}
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            {CATEGORY_LABELS[category] ?? category}
          </p>
          {items.map((item) => (
            <ActivityProgressInput
              key={item.id}
              id={item.id}
              name={item.name}
              unit={item.unit}
              category={item.category}
              totalPrice={parseFloat(item.total_price)}
              previousPct={item.previous_progress_pct}
              currentPct={progress[item.id] ?? 0}
              onChange={handleProgressChange}
            />
          ))}
        </div>
      ))}

      {/* Summary repeated at bottom after items */}
      {hasAnyProgress && (
        <CorteSummary
          totalExecuted={totalExecuted}
          advancePercentage={advancePercentage}
          quotedAmount={quotedAmount}
          cumulativeProgress={cumulativeProgress}
        />
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-px" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <Button className="w-full" disabled={!hasAnyProgress || submitting} onClick={handleSubmit}>
        {submitting ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando borrador...</>
        ) : (
          `Guardar Corte #${cutNumber} como borrador`
        )}
      </Button>
      <p className="text-xs text-center text-muted-foreground">
        Se guarda como borrador — puedes enviarlo al cliente desde la pantalla de detalle
      </p>
    </div>
  )
}
