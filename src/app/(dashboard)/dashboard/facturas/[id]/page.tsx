import { db } from "@/lib/db"
import { invoices, invoice_allocations, projects } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  FileImage,
  Clock,
  CheckCircle2,
  Building2,
  ChevronRight,
} from "lucide-react"

export const revalidate = 0

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
})

interface Props {
  params: { id: string }
}

const STATUS_CONFIG = {
  pending_allocation: { label: "Sin asignar", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  allocated: { label: "Asignada", color: "text-green-600", bg: "bg-green-50 border-green-200" },
  verified: { label: "Verificada", color: "text-primary", bg: "bg-primary/10 border-primary/20" },
}

export default async function FacturaDetailPage({ params }: Props) {
  await requireAuth()

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, params.id))

  if (!invoice) notFound()

  const allocations = await db
    .select({
      id: invoice_allocations.id,
      project_id: invoice_allocations.project_id,
      amount: invoice_allocations.amount,
      percentage: invoice_allocations.percentage,
      category: invoice_allocations.category,
      notes: invoice_allocations.notes,
      project_name: projects.name,
    })
    .from(invoice_allocations)
    .leftJoin(projects, eq(invoice_allocations.project_id, projects.id))
    .where(eq(invoice_allocations.invoice_id, params.id))

  const cfg = STATUS_CONFIG[invoice.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending_allocation
  const total = parseFloat(invoice.total_amount)

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/facturas" className="text-muted-foreground hover:text-foreground p-1 -m-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">{invoice.supplier_name}</h1>
          <p className="text-xs text-muted-foreground">{invoice.invoice_number} · {invoice.invoice_date}</p>
        </div>
      </div>

      {/* Status badge */}
      <div className={`flex items-center gap-2 p-3 rounded-xl border ${cfg.bg}`}>
        {invoice.status === "pending_allocation" ? (
          <Clock className={`w-4 h-4 ${cfg.color}`} />
        ) : (
          <CheckCircle2 className={`w-4 h-4 ${cfg.color}`} />
        )}
        <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
        {invoice.status === "pending_allocation" && (
          <Button asChild size="sm" className="ml-auto h-7 text-xs">
            <Link href={`/dashboard/facturas/${params.id}/asignar`}>
              Asignar ahora
            </Link>
          </Button>
        )}
      </div>

      {/* Montos */}
      <div className="section-card space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Montos</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{COP.format(parseFloat(invoice.subtotal))}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">IVA</span>
            <span className="tabular-nums">{COP.format(parseFloat(invoice.tax_amount))}</span>
          </div>
          <div className="flex justify-between text-base font-bold pt-2 border-t">
            <span>Total</span>
            <span className="tabular-nums">{COP.format(total)}</span>
          </div>
        </div>
      </div>

      {/* Supplier info */}
      {invoice.supplier_nit && (
        <div className="section-card">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Proveedor</h2>
          <p className="text-sm font-medium">{invoice.supplier_name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">NIT: {invoice.supplier_nit}</p>
        </div>
      )}

      {/* Allocations */}
      {allocations.length > 0 && (
        <div className="section-card space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Asignación a proyectos
          </h2>
          <div className="space-y-2">
            {allocations.map((a) => (
              <Link
                key={a.id}
                href={`/dashboard/proyectos/${a.project_id}`}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors"
              >
                <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.project_name ?? "Proyecto"}</p>
                  <p className="text-xs text-muted-foreground capitalize">{a.category}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold tabular-nums">{COP.format(parseFloat(a.amount))}</p>
                  <p className="text-xs text-muted-foreground">{parseFloat(a.percentage).toFixed(1)}%</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Invoice image */}
      {invoice.image_url && (
        <div className="section-card space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Imagen</h2>
          <a href={`/api/blob?url=${encodeURIComponent(invoice.image_url)}`} target="_blank" rel="noopener noreferrer" className="block">
            <div className="rounded-lg overflow-hidden border aspect-video bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/blob?url=${encodeURIComponent(invoice.image_url)}`} alt="Factura" className="w-full h-full object-contain" />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
              <FileImage className="w-3 h-3" />
              Ver imagen original
            </p>
          </a>
        </div>
      )}

      {/* Notes */}
      {invoice.notes && (
        <div className="section-card">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notas</h2>
          <p className="text-sm text-muted-foreground">{invoice.notes}</p>
        </div>
      )}
    </div>
  )
}
