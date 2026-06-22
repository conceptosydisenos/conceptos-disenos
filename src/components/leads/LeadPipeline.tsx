"use client"

import { useState } from "react"
import { LeadCard, type LeadRow } from "./LeadCard"
import { InboxIcon } from "lucide-react"

export const PIPELINE_STAGES = [
  { key: "new",            label: "Nuevo",              color: "border-t-gray-400",   dot: "bg-gray-400"   },
  { key: "contacted",      label: "Contactado",         color: "border-t-blue-400",   dot: "bg-blue-400"   },
  { key: "visit_scheduled",label: "Visita agendada",    color: "border-t-violet-400", dot: "bg-violet-400" },
  { key: "quoted",         label: "Cotización enviada", color: "border-t-amber-400",  dot: "bg-amber-400"  },
  { key: "won",            label: "Ganado",             color: "border-t-emerald-500",dot: "bg-emerald-500"},
  { key: "lost",           label: "Perdido",            color: "border-t-red-400",    dot: "bg-red-400"    },
] as const

type StageKey = (typeof PIPELINE_STAGES)[number]["key"]

interface LeadPipelineProps {
  leads: LeadRow[]
}

export function LeadPipeline({ leads }: LeadPipelineProps) {
  const [activeStage, setActiveStage] = useState<StageKey>("new")

  const byStage = Object.fromEntries(
    PIPELINE_STAGES.map((s) => [s.key, leads.filter((l) => l.status === s.key)])
  ) as Record<StageKey, LeadRow[]>

  const activeStageData = PIPELINE_STAGES.find((s) => s.key === activeStage)!

  return (
    <div>
      {/* Stage tabs — horizontal scroll, all viewports */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mb-px scrollbar-none">
        {PIPELINE_STAGES.map((stage) => {
          const count = byStage[stage.key].length
          const isActive = activeStage === stage.key
          return (
            <button
              key={stage.key}
              onClick={() => setActiveStage(stage.key)}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-t-lg text-xs font-medium
                whitespace-nowrap transition-colors shrink-0 border border-b-0
                ${isActive
                  ? "bg-card border-border text-foreground"
                  : "bg-muted/40 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/70"
                }
              `}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${stage.dot} ${isActive ? "opacity-100" : "opacity-50"}`} />
              <span className="hidden sm:inline">{stage.label}</span>
              <span className="sm:hidden">{stage.label.split(" ")[0]}</span>
              <span className={`text-[10px] tabular-nums rounded-full px-1.5 py-0.5 leading-none
                ${isActive
                  ? "bg-primary text-primary-foreground"
                  : count > 0 ? "bg-muted-foreground/20 text-muted-foreground" : "text-muted-foreground/40"
                }
              `}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Mobile / tablet: single column, selected stage */}
      <div className={`md:hidden border border-border rounded-b-xl rounded-tr-xl bg-card p-3`}>
        <div className={`h-1 w-12 rounded-full mb-3 ${activeStageData.dot}`} />
        {byStage[activeStage].length === 0 ? (
          <EmptyStage label={activeStageData.label} />
        ) : (
          <div className="space-y-2">
            {byStage[activeStage].map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: all columns side by side */}
      <div className="hidden md:flex gap-3 overflow-x-auto pb-3">
        {PIPELINE_STAGES.map((stage) => (
          <div
            key={stage.key}
            className={`
              flex-none w-[272px] bg-card border border-border rounded-b-xl rounded-tr-xl
              border-t-2 ${stage.color}
            `}
          >
            <div className="px-3 pt-3 pb-2 border-b border-border/60">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">{stage.label}</span>
                <span className="text-xs font-bold tabular-nums text-muted-foreground">
                  {byStage[stage.key].length}
                </span>
              </div>
            </div>
            <div className="p-3 space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
              {byStage[stage.key].length === 0 ? (
                <EmptyStage label={stage.label} compact />
              ) : (
                byStage[stage.key].map((lead) => (
                  <LeadCard key={lead.id} lead={lead} />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyStage({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "py-6" : "py-10"}`}>
      <InboxIcon className="w-7 h-7 text-muted-foreground/25 mb-2" />
      <p className="text-xs text-muted-foreground">Sin leads en {label}</p>
    </div>
  )
}
