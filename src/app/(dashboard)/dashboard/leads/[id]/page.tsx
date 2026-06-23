import { db } from "@/lib/db"
import { leads, lead_activities, users } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { and, desc, eq, isNull } from "drizzle-orm"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Phone, Mail, MapPin, FileText, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AddActivityForm } from "@/components/leads/AddActivityForm"
import { LeadStatusSelector } from "@/components/leads/LeadStatusSelector"
import { formatCOP } from "@/lib/utils"

export const revalidate = 0

const SOURCE_LABELS: Record<string, string> = {
  referido:        "Referido",
  voz_a_voz:       "Voz a voz",
  volante:         "Volante",
  aliado:          "Aliado",
  web:             "Web",
  redes:           "Redes sociales",
  whatsapp:        "WhatsApp",
  llamada_directa: "Llamada directa",
  otro:            "Otro",
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  new:             { label: "Nuevo",               className: "bg-gray-100 text-gray-600 border-gray-200" },
  contacted:       { label: "Contactado",          className: "bg-blue-100 text-blue-700 border-blue-200" },
  visit_scheduled: { label: "Visita agendada",     className: "bg-violet-100 text-violet-700 border-violet-200" },
  quoted:          { label: "Cotización enviada",  className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  won:             { label: "Ganado",              className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  lost:            { label: "Perdido",             className: "bg-red-100 text-red-700 border-red-200" },
}

const ACTIVITY_ICONS: Record<string, string> = {
  llamada:             "📞",
  email:               "📧",
  visita:              "🏠",
  whatsapp:            "💬",
  nota:                "📝",
  cotizacion_enviada:  "📄",
  cambio_estado:       "🔄",
}

function formatDateTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

interface Props {
  params: { id: string }
}

export default async function LeadDetailPage({ params }: Props) {
  await requireAuth()

  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, params.id), isNull(leads.deleted_at)))

  if (!lead) notFound()

  const activities = await db
    .select({
      id:              lead_activities.id,
      activity_type:   lead_activities.activity_type,
      occurred_at:     lead_activities.occurred_at,
      summary:         lead_activities.summary,
      outcome:         lead_activities.outcome,
      previous_status: lead_activities.previous_status,
      new_status:      lead_activities.new_status,
      author_name:     users.name,
    })
    .from(lead_activities)
    .leftJoin(users, eq(lead_activities.created_by, users.id))
    .where(eq(lead_activities.lead_id, params.id))
    .orderBy(desc(lead_activities.occurred_at))

  const statusCfg = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.new
  const isWon   = lead.status === "won"
  const isLost  = lead.status === "lost"
  const isClosed = isWon || isLost

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/leads" className="text-muted-foreground hover:text-foreground p-1 -m-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">{lead.contact_name}</h1>
          <p className="text-xs text-muted-foreground">
            {SOURCE_LABELS[lead.source] ?? lead.source} ·{" "}
            {new Date(lead.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
        <Badge variant="outline" className={`shrink-0 ${statusCfg.className}`}>
          {statusCfg.label}
        </Badge>
      </div>

      {/* Cambiar estado */}
      <LeadStatusSelector leadId={lead.id} currentStatus={lead.status} />

      {/* CTA ganado → crear cotización */}
      {isWon && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-800">¡Lead ganado!</p>
            <p className="text-xs text-emerald-700 mt-0.5">Ahora puedes crear la cotización del proyecto.</p>
          </div>
          <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0">
            <Link href={`/dashboard/cotizaciones/nueva?lead_id=${lead.id}`}>
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Cotizar
            </Link>
          </Button>
        </div>
      )}

      {/* Contacto */}
      <div className="section-card space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contacto</h2>
        <div className="space-y-2">
          <a
            href={`tel:${lead.contact_phone}`}
            className="flex items-center gap-3 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <Phone className="w-4 h-4 text-muted-foreground" />
            {lead.contact_phone}
          </a>
          {lead.contact_email && (
            <a
              href={`mailto:${lead.contact_email}`}
              className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Mail className="w-4 h-4" />
              {lead.contact_email}
            </a>
          )}
          {lead.project_address && (
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{lead.project_address}</span>
            </div>
          )}
        </div>
      </div>

      {/* Proyecto */}
      <div className="section-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Proyecto</h2>
          {lead.estimated_value && (
            <span className="text-sm font-bold tabular-nums text-foreground">
              {formatCOP(lead.estimated_value)}
            </span>
          )}
        </div>
        <p className="text-sm text-foreground leading-relaxed">{lead.project_description}</p>
        {lead.notes && (
          <p className="text-xs text-muted-foreground border-t border-border pt-3 mt-1 leading-relaxed">
            {lead.notes}
          </p>
        )}
      </div>

      {/* Registrar actividad */}
      {!isClosed && (
        <div className="section-card space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Registrar actividad</h2>
          <AddActivityForm leadId={lead.id} />
        </div>
      )}

      {/* Historial */}
      {activities.length > 0 && (
        <div className="section-card space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Historial ({activities.length})
          </h2>
          <div className="space-y-3">
            {activities.map((a) => (
              <div key={a.id} className="flex gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-base shrink-0 mt-0.5">
                  {ACTIVITY_ICONS[a.activity_type] ?? "📌"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 justify-between">
                    <p className="text-sm font-medium text-foreground leading-snug">{a.summary}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                      {formatDateTime(a.occurred_at)}
                    </span>
                  </div>
                  {a.outcome && (
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{a.outcome}</p>
                  )}
                  {a.author_name && (
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{a.author_name}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
