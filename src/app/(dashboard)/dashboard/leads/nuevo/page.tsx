import { requireAuth } from "@/lib/auth"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { LeadForm } from "@/components/leads/LeadForm"

export default async function NuevoLeadPage() {
  await requireAuth()

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/leads" className="text-muted-foreground hover:text-foreground p-1 -m-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold">Nuevo lead</h1>
          <p className="text-xs text-muted-foreground">Registra un prospecto de cliente</p>
        </div>
      </div>

      <div className="section-card">
        <LeadForm />
      </div>
    </div>
  )
}
