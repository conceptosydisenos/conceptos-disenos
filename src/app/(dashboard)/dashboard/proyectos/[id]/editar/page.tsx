import { db } from "@/lib/db"
import { projects, clients } from "@/lib/db/schema"
import { requireRole } from "@/lib/auth"
import { eq, and, isNull } from "drizzle-orm"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Header } from "@/components/layout/Header"
import { ProyectoForm } from "@/components/proyectos/ProyectoForm"

interface PageProps {
  params: { id: string }
}

export default async function EditarProyectoPage({ params }: PageProps) {
  await requireRole(["admin"])

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, params.id), isNull(projects.deleted_at)))

  if (!project) notFound()

  const clientList = await db
    .select({ id: clients.id, name: clients.name, nit: clients.nit })
    .from(clients)
    .orderBy(clients.name)

  const initialValues = {
    client_id: project.client_id,
    name: project.name,
    description: project.description ?? "",
    quoted_amount: parseFloat(project.quoted_amount),
    advance_percentage: parseFloat(project.advance_percentage),
    contingency_percentage: parseFloat(project.contingency_percentage),
    start_date: project.start_date,
    estimated_end_date: project.estimated_end_date ?? "",
  }

  return (
    <div>
      <Header title="Editar proyecto" subtitle={project.name} />
      <div className="px-4 md:px-6 py-6 max-w-xl">
        <Link
          href={`/dashboard/proyectos/${params.id}`}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver al proyecto
        </Link>

        <div className="section-card">
          <ProyectoForm
            clients={clientList}
            projectId={params.id}
            initialValues={initialValues}
          />
        </div>
      </div>
    </div>
  )
}
