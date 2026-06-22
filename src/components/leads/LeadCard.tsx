"use client"

import Link from "next/link"
import { Phone, MapPin, ChevronRight, Clock } from "lucide-react"
import { formatCOP } from "@/lib/utils"

export type LeadRow = {
  id: string
  contact_name: string
  contact_phone: string
  project_description: string
  project_address: string | null
  estimated_value: string | null
  source: string
  status: string
  created_at: Date | string
}

const SOURCE_LABELS: Record<string, string> = {
  referido: "Referido",
  voz_a_voz: "Voz a voz",
  volante: "Volante",
  aliado: "Aliado",
  web: "Web",
  redes: "Redes",
  whatsapp: "WhatsApp",
  llamada_directa: "Llamada",
  otro: "Otro",
}

const SOURCE_COLORS: Record<string, string> = {
  referido: "bg-emerald-100 text-emerald-700",
  voz_a_voz: "bg-teal-100 text-teal-700",
  volante: "bg-sky-100 text-sky-700",
  aliado: "bg-violet-100 text-violet-700",
  web: "bg-blue-100 text-blue-700",
  redes: "bg-pink-100 text-pink-700",
  whatsapp: "bg-green-100 text-green-700",
  llamada_directa: "bg-amber-100 text-amber-700",
  otro: "bg-gray-100 text-gray-600",
}

function daysAgo(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date
  const diff = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (diff === 0) return "hoy"
  if (diff === 1) return "ayer"
  return `hace ${diff}d`
}

interface LeadCardProps {
  lead: LeadRow
}

export function LeadCard({ lead }: LeadCardProps) {
  const sourceLabel = SOURCE_LABELS[lead.source] ?? lead.source
  const sourceColor = SOURCE_COLORS[lead.source] ?? SOURCE_COLORS.otro

  return (
    <Link
      href={`/dashboard/leads/${lead.id}`}
      className="block bg-card rounded-xl border border-border p-4 hover:shadow-md hover:border-primary/20 transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-foreground leading-tight group-hover:text-primary transition-colors">
          {lead.contact_name}
        </p>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${sourceColor}`}>
          {sourceLabel}
        </span>
      </div>

      <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
        {lead.project_description}
      </p>

      {lead.project_address && (
        <div className="flex items-center gap-1.5 mb-2">
          <MapPin className="w-3 h-3 text-muted-foreground/60 shrink-0" />
          <span className="text-xs text-muted-foreground truncate">{lead.project_address}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/60">
        <div className="flex items-center gap-3">
          <a
            href={`tel:${lead.contact_phone}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <Phone className="w-3 h-3" />
            {lead.contact_phone}
          </a>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lead.estimated_value && (
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {formatCOP(lead.estimated_value)}
            </span>
          )}
          <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <Clock className="w-3 h-3" />
            {daysAgo(lead.created_at)}
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
        </div>
      </div>
    </Link>
  )
}
