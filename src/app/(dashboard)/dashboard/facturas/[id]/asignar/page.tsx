import { db } from "@/lib/db"
import { invoices, projects } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { eq, inArray } from "drizzle-orm"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { AllocationForm } from "@/components/facturas/AllocationForm"

interface Props {
  params: { id: string }
}

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
})

export default async function AsignarPage({ params }: Props) {
  await requireAuth()

  const [invoice] = await db
    .select({
      id: invoices.id,
      invoice_number: invoices.invoice_number,
      supplier_name: invoices.supplier_name,
      invoice_date: invoices.invoice_date,
      total_amount: invoices.total_amount,
      status: invoices.status,
    })
    .from(invoices)
    .where(eq(invoices.id, params.id))

  if (!invoice) notFound()

  // Already allocated — redirect to detail
  if (invoice.status !== "pending_allocation") {
    redirect(`/dashboard/facturas/${params.id}`)
  }

  const activeProjects = await db
    .select({ id: projects.id, name: projects.name, status: projects.status })
    .from(projects)
    .where(
      inArray(projects.status, ["active", "paused", "in_warranty"])
    )
    .orderBy(projects.name)

  const total = parseFloat(invoice.total_amount)

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard/facturas/${params.id}`}
          className="text-muted-foreground hover:text-foreground p-1 -m-1"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold">Asignar factura</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Distribuye el costo entre los proyectos
          </p>
        </div>
      </div>

      {/* Invoice summary */}
      <div className="rounded-xl border bg-muted/30 p-4 space-y-1">
        <p className="text-sm font-semibold text-foreground">{invoice.supplier_name}</p>
        <p className="text-xs text-muted-foreground">{invoice.invoice_number} · {invoice.invoice_date}</p>
        <p className="text-xl font-bold tabular-nums text-foreground mt-1">
          {COP.format(total)}
        </p>
        <p className="text-xs text-muted-foreground">Total a distribuir</p>
      </div>

      {activeProjects.length === 0 ? (
        <div className="section-card text-center py-10">
          <p className="text-sm text-muted-foreground">No hay proyectos activos disponibles.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Crea o activa un proyecto antes de asignar facturas.
          </p>
          <Link href="/dashboard/proyectos" className="text-sm text-primary font-medium mt-3 block">
            Ver proyectos →
          </Link>
        </div>
      ) : (
        <AllocationForm
          invoiceId={invoice.id}
          invoiceTotal={total}
          projects={activeProjects}
        />
      )}
    </div>
  )
}
