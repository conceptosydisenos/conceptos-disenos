import { db } from "@/lib/db"
import { invoices, invoice_allocations, projects } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { desc, eq, count } from "drizzle-orm"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Camera, Clock, CheckCircle2, AlertTriangle } from "lucide-react"

export const revalidate = 0

const STATUS_CONFIG = {
  pending_allocation: {
    label: "Sin asignar",
    variant: "outline" as const,
    icon: Clock,
    color: "text-amber-600",
  },
  allocated: {
    label: "Asignada",
    variant: "secondary" as const,
    icon: CheckCircle2,
    color: "text-green-600",
  },
  verified: {
    label: "Verificada",
    variant: "default" as const,
    icon: CheckCircle2,
    color: "text-primary",
  },
}

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
})

export default async function FacturasPage() {
  await requireAuth()

  const rows = await db
    .select({
      id: invoices.id,
      invoice_number: invoices.invoice_number,
      supplier_name: invoices.supplier_name,
      invoice_date: invoices.invoice_date,
      total_amount: invoices.total_amount,
      status: invoices.status,
      created_at: invoices.created_at,
    })
    .from(invoices)
    .orderBy(desc(invoices.created_at))
    .limit(100)

  const pendingCount = rows.filter((r) => r.status === "pending_allocation").length

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Facturas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {rows.length} factura{rows.length !== 1 ? "s" : ""} registrada{rows.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button asChild size="sm" className="gap-2">
          <Link href="/dashboard/facturas/nueva">
            <Camera className="w-4 h-4" />
            Nueva
          </Link>
        </Button>
      </div>

      {/* Pending alert */}
      {pendingCount > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-px" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {pendingCount} factura{pendingCount !== 1 ? "s" : ""} sin asignar
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Asigna cada factura a un proyecto para registrar el costo correctamente.
            </p>
          </div>
        </div>
      )}

      {/* List */}
      {rows.length === 0 ? (
        <div className="section-card flex flex-col items-center justify-center py-16 text-center">
          <Camera className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Sin facturas registradas</p>
          <p className="text-xs text-muted-foreground mt-1">Toca &ldquo;Nueva&rdquo; para registrar la primera factura</p>
          <Button asChild size="sm" className="mt-4 gap-2">
            <Link href="/dashboard/facturas/nueva">
              <Camera className="w-4 h-4" />
              Registrar factura
            </Link>
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border bg-card overflow-hidden">
          {rows.map((row) => {
            const cfg = STATUS_CONFIG[row.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending_allocation
            const Icon = cfg.icon
            const isPending = row.status === "pending_allocation"
            return (
              <Link
                key={row.id}
                href={isPending ? `/dashboard/facturas/${row.id}/asignar` : `/dashboard/facturas/${row.id}`}
                className="flex items-start gap-3 p-4 hover:bg-muted/30 active:bg-muted/50 transition-colors"
              >
                <div className={`mt-0.5 shrink-0 ${cfg.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-sm font-medium text-foreground truncate">{row.supplier_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.invoice_number} · {row.invoice_date}
                  </p>
                </div>
                <div className="shrink-0 text-right space-y-1">
                  <p className="text-sm font-bold tabular-nums">
                    {COP.format(parseFloat(row.total_amount))}
                  </p>
                  <Badge variant={cfg.variant} className="text-[10px] px-1.5 py-0">
                    {cfg.label}
                  </Badge>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
