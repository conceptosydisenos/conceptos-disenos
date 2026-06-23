"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, Loader2 } from "lucide-react"

const STAGES = [
  { key: "new",             label: "Nuevo",              color: "text-gray-600   bg-gray-100   hover:bg-gray-200"   },
  { key: "contacted",       label: "Contactado",         color: "text-blue-700   bg-blue-100   hover:bg-blue-200"   },
  { key: "visit_scheduled", label: "Visita",             color: "text-violet-700 bg-violet-100 hover:bg-violet-200" },
  { key: "quoted",          label: "Cotización",         color: "text-emerald-700  bg-emerald-100  hover:bg-emerald-200"  },
  { key: "won",             label: "Ganado",             color: "text-emerald-700 bg-emerald-100 hover:bg-emerald-200" },
  { key: "lost",            label: "Perdido",            color: "text-red-700    bg-red-100    hover:bg-red-200"    },
] as const

type StageKey = (typeof STAGES)[number]["key"]

interface Props {
  leadId: string
  currentStatus: string
}

export function LeadStatusSelector({ leadId, currentStatus }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<StageKey | null>(null)

  const currentIdx = STAGES.findIndex((s) => s.key === currentStatus)
  const isClosed = currentStatus === "won" || currentStatus === "lost"

  async function moveTo(status: StageKey) {
    if (status === currentStatus || loading) return
    setLoading(status)

    try {
      await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      router.refresh()
    } finally {
      setLoading(null)
    }
  }

  if (isClosed) return null

  const nextStage = STAGES[currentIdx + 1]
  const prevStage = currentIdx > 0 ? STAGES[currentIdx - 1] : null

  return (
    <div className="section-card space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mover etapa</p>

      {/* Progress bar */}
      <div className="flex gap-1">
        {STAGES.filter((s) => s.key !== "lost").map((s, i) => (
          <div
            key={s.key}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= currentIdx ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Quick action buttons */}
      <div className="flex items-center gap-2">
        {prevStage && (
          <button
            onClick={() => moveTo(prevStage.key)}
            disabled={loading !== null}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors
              ${prevStage.color} disabled:opacity-50`}
          >
            {loading === prevStage.key ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 rotate-180" />
            )}
            {prevStage.label}
          </button>
        )}

        {nextStage && (
          <button
            onClick={() => moveTo(nextStage.key)}
            disabled={loading !== null}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors
              bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50`}
          >
            {loading === nextStage.key ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : null}
            Mover a {nextStage.label}
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* Mark as lost from any non-closed state */}
        {currentStatus !== "won" && currentStatus !== "lost" && (
          <button
            onClick={() => moveTo("lost")}
            disabled={loading !== null}
            className="px-3 py-2 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50 shrink-0"
          >
            {loading === "lost" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Perdido"}
          </button>
        )}
      </div>
    </div>
  )
}
