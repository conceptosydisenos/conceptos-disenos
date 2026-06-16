import { db } from "@/lib/db"
import { contractors, project_contractors, projects } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { and, eq, inArray, notInArray } from "drizzle-orm"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { VinculacionForm } from "@/components/contratistas/VinculacionForm"

export const revalidate = 0

export default async function VincularPage({ params }: { params: { id: string } }) {
  await requireAuth()

  const [contractor] = await db
    .select({ id: contractors.id, name: contractors.name })
    .from(contractors)
    .where(eq(contractors.id, params.id))

  if (!contractor) notFound()

  const alreadyLinked = await db
    .select({ project_id: project_contractors.project_id })
    .from(project_contractors)
    .where(
      and(
        eq(project_contractors.contractor_id, params.id),
        eq(project_contractors.status, "active")
      )
    )
  const linkedIds = alreadyLinked.map((r) => r.project_id).filter(Boolean) as string[]

  const availableQuery = db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(
      inArray(projects.status, ["active", "paused"])
    )

  const allProjects = await availableQuery

  const available = linkedIds.length > 0
    ? allProjects.filter((p) => !linkedIds.includes(p.id))
    : allProjects

  return (
    <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/contratistas/${params.id}`} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold leading-none">Vincular a proyecto</h1>
          <p className="text-sm text-muted-foreground">{contractor.name}</p>
        </div>
      </div>

      {available.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No hay proyectos activos disponibles para vincular.</p>
          <p className="text-xs mt-1">El contratista ya está vinculado a todos los proyectos activos.</p>
        </div>
      ) : (
        <VinculacionForm
          contractorId={contractor.id}
          contractorName={contractor.name}
          availableProjects={available}
        />
      )}
    </main>
  )
}
