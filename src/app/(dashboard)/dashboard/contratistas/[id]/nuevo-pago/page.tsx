import { db } from "@/lib/db"
import { contractors, project_contractors, contractor_payments, projects } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { eq, and, sum } from "drizzle-orm"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PagoForm } from "@/components/contratistas/PagoForm"

export const revalidate = 0

export default async function NuevoPagoPage({ params }: { params: { id: string } }) {
  await requireAuth()

  const [contractor] = await db
    .select({ id: contractors.id, name: contractors.name })
    .from(contractors)
    .where(eq(contractors.id, params.id))

  if (!contractor) notFound()

  const projectLinks = await db
    .select({
      pc_id: project_contractors.id,
      project_id: project_contractors.project_id,
      project_name: projects.name,
      contract_amount: project_contractors.contract_amount,
    })
    .from(project_contractors)
    .leftJoin(projects, eq(project_contractors.project_id, projects.id))
    .where(
      and(
        eq(project_contractors.contractor_id, params.id),
        eq(project_contractors.status, "active")
      )
    )

  const projectsWithBalance = await Promise.all(
    projectLinks.map(async (pl) => {
      const [paid] = await db
        .select({ total: sum(contractor_payments.amount) })
        .from(contractor_payments)
        .where(
          and(
            eq(contractor_payments.contractor_id, params.id),
            eq(contractor_payments.project_id, pl.project_id!),
            eq(contractor_payments.status, "paid")
          )
        )
      const balance = parseFloat(pl.contract_amount) - parseFloat(paid.total ?? "0")
      return { ...pl, balance: Math.max(0, balance) }
    })
  )

  return (
    <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/contratistas/${params.id}`} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold leading-none">Registrar pago</h1>
          <p className="text-sm text-muted-foreground">Nuevo pago a contratista</p>
        </div>
      </div>
      <PagoForm
        contractorId={contractor.id}
        contractorName={contractor.name}
        projects={projectsWithBalance}
      />
    </main>
  )
}
