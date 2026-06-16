import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { clients } from "@/lib/db/schema"
import { requireRole } from "@/lib/auth"
import { Header } from "@/components/layout/Header"
import { ProyectoForm } from "@/components/proyectos/ProyectoForm"
import { asc } from "drizzle-orm"

export default async function NuevoProyectoPage() {
  try {
    await requireRole(["admin", "accountant"])
  } catch {
    redirect("/dashboard/proyectos")
  }

  const clientList = await db
    .select({ id: clients.id, name: clients.name, nit: clients.nit })
    .from(clients)
    .orderBy(asc(clients.name))

  return (
    <div>
      <Header title="Nuevo proyecto" subtitle="Proyectos" />
      <div className="px-4 md:px-6 py-6 max-w-xl">
        <div className="section-card">
          <h2 className="text-base font-semibold mb-5">Datos del proyecto</h2>
          <ProyectoForm clients={clientList} />
        </div>
      </div>
    </div>
  )
}
