import { db } from "@/lib/db"
import { invoices } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { and, eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { FacturaEditForm } from "@/components/facturas/FacturaEditForm"

interface Props {
  params: { id: string }
}

export default async function EditarFacturaPage({ params }: Props) {
  const user = await requireAuth()

  const ownershipFilter =
    user.role === "admin"
      ? eq(invoices.id, params.id)
      : and(eq(invoices.id, params.id), eq(invoices.created_by, user.id))

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(ownershipFilter)

  if (!invoice) notFound()

  const initialValues = {
    invoice_number: invoice.invoice_number,
    supplier_name: invoice.supplier_name,
    supplier_nit: invoice.supplier_nit ?? "",
    invoice_date: invoice.invoice_date,
    subtotal: parseFloat(invoice.subtotal),
    tax_amount: parseFloat(invoice.tax_amount),
    total_amount: parseFloat(invoice.total_amount),
    notes: invoice.notes ?? "",
  }

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/facturas/${params.id}`} className="text-muted-foreground hover:text-foreground p-1 -m-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">Editar factura</h1>
          <p className="text-xs text-muted-foreground truncate">
            {invoice.supplier_name} · {invoice.invoice_number}
          </p>
        </div>
      </div>

      <div className="section-card">
        <FacturaEditForm invoiceId={params.id} initialValues={initialValues} />
      </div>
    </div>
  )
}
