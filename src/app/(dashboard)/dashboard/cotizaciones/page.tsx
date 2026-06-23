import { db } from "@/lib/db"
import { quotes, clients } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { desc, eq, isNull } from "drizzle-orm"
import Link from "next/link"
import { Plus, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatCOP } from "@/lib/utils"

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft:     { label: "Borrador",  className: "bg-muted text-muted-foreground" },
  sent:      { label: "Enviada",   className: "bg-blue-100 text-blue-700" },
  approved:  { label: "Aprobada",  className: "bg-emerald-100 text-emerald-700" },
  rejected:  { label: "Rechazada", className: "bg-destructive/10 text-destructive" },
  converted: { label: "Convertida",className: "bg-violet-100 text-violet-700" },
}

export default async function CotizacionesPage() {
  await requireAuth()

  const rows = await db
    .select({
      id:           quotes.id,
      quote_number: quotes.quote_number,
      project_name: quotes.project_name,
      contact_name: quotes.contact_name,
      status:       quotes.status,
      total_amount: quotes.total_amount,
      valid_until:  quotes.valid_until,
      created_at:   quotes.created_at,
      client_name:  clients.name,
    })
    .from(quotes)
    .leftJoin(clients, eq(quotes.client_id, clients.id))
    .where(isNull(quotes.deleted_at))
    .orderBy(desc(quotes.created_at))

  return (
    <main className="px-4 pt-6 pb-24 md:px-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Cotizaciones</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{rows.length} cotizaciones</p>
        </div>
        <Link href="/dashboard/cotizaciones/nueva">
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nueva cotización</span>
            <span className="sm:hidden">Nueva</span>
          </Button>
        </Link>
      </div>

      {/* Empty state */}
      {rows.length === 0 && (
        <div className="section-card flex flex-col items-center py-16 text-center gap-3">
          <FileText className="w-10 h-10 text-muted-foreground/40" />
          <div>
            <p className="font-medium text-foreground">Sin cotizaciones aún</p>
            <p className="text-sm text-muted-foreground mt-1">
              Crea tu primera cotización desde un lead ganado o desde cero.
            </p>
          </div>
          <Link href="/dashboard/cotizaciones/nueva">
            <Button size="sm" className="mt-2">Crear cotización</Button>
          </Link>
        </div>
      )}

      {/* List */}
      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((q) => {
            const cfg = STATUS_CONFIG[q.status] ?? STATUS_CONFIG.draft
            const total = parseFloat(q.total_amount)
            const validDate = new Date(q.valid_until)
            const isExpired = validDate < new Date() && q.status === "sent"

            return (
              <Link
                key={q.id}
                href={`/dashboard/cotizaciones/${q.id}`}
                className="block section-card hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">{q.quote_number}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.className}`}>
                        {cfg.label}
                      </span>
                      {isExpired && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700">
                          Vencida
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-foreground mt-1 truncate">{q.project_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {q.client_name ?? q.contact_name ?? "Sin contacto"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums">{formatCOP(total)}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      válida {validDate.toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
