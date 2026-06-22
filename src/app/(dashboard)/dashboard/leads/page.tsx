import { db } from "@/lib/db"
import { leads } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { isNull } from "drizzle-orm"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { LeadPipeline } from "@/components/leads/LeadPipeline"
import { Plus, Users } from "lucide-react"
import Link from "next/link"
import type { LeadRow } from "@/components/leads/LeadCard"

export const revalidate = 0

export default async function LeadsPage() {
  await requireAuth()

  const rows = await db
    .select({
      id: leads.id,
      contact_name: leads.contact_name,
      contact_phone: leads.contact_phone,
      project_description: leads.project_description,
      project_address: leads.project_address,
      estimated_value: leads.estimated_value,
      source: leads.source,
      status: leads.status,
      created_at: leads.created_at,
    })
    .from(leads)
    .where(isNull(leads.deleted_at))

  const leadRows = rows.map((r) => ({
    ...r,
    created_at: r.created_at instanceof Date ? r.created_at : new Date(r.created_at),
  })) satisfies LeadRow[]

  return (
    <div>
      <Header title="Pipeline de leads" />

      <div className="px-4 md:px-6 py-5 space-y-4">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{rows.length} lead{rows.length !== 1 ? "s" : ""} en total</span>
          </div>
          <Button asChild size="sm">
            <Link href="/dashboard/leads/nuevo">
              <Plus className="w-4 h-4 mr-1" />
              Nuevo lead
            </Link>
          </Button>
        </div>

        {/* Pipeline */}
        <LeadPipeline leads={leadRows} />
      </div>
    </div>
  )
}
