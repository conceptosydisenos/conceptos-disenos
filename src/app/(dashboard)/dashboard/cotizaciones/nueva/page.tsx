import { db } from "@/lib/db"
import { leads } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { eq } from "drizzle-orm"
import { QuoteForm } from "@/components/cotizaciones/QuoteForm"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

interface Props {
  searchParams: { lead_id?: string }
}

export default async function NuevaCotizacionPage({ searchParams }: Props) {
  await requireAuth()

  let initialValues: {
    project_name?: string
    contact_name?: string
    contact_phone?: string
    contact_email?: string
    lead_id?: string
  } = {}

  if (searchParams.lead_id) {
    const [lead] = await db
      .select({
        id:           leads.id,
        contact_name: leads.contact_name,
        contact_phone:leads.contact_phone,
        contact_email:leads.contact_email,
        project_address: leads.project_address,
      })
      .from(leads)
      .where(eq(leads.id, searchParams.lead_id))

    if (lead) {
      initialValues = {
        lead_id:      lead.id,
        contact_name: lead.contact_name,
        contact_phone:lead.contact_phone,
        contact_email:lead.contact_email ?? undefined,
        project_name: lead.project_address ?? "",
      }
    }
  }

  return (
    <main className="px-4 pt-6 pb-24 md:px-8 max-w-xl mx-auto space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/dashboard/cotizaciones" className="p-1.5 -ml-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">Nueva cotización</h1>
          {initialValues.contact_name && (
            <p className="text-sm text-muted-foreground mt-0.5">
              Lead: {initialValues.contact_name}
            </p>
          )}
        </div>
      </div>

      <div className="section-card">
        <QuoteForm initialValues={Object.keys(initialValues).length > 0 ? initialValues : undefined} />
      </div>
    </main>
  )
}
