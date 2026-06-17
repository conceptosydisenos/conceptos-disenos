import { db } from "@/lib/db"
import { clients } from "@/lib/db/schema"
import { requireRole } from "@/lib/auth"
import { Header } from "@/components/layout/Header"
import { asc } from "drizzle-orm"
import { ClientesList } from "@/components/clientes/ClientesList"

export const revalidate = 0

export default async function ClientesPage() {
  await requireRole(["admin"])

  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      nit: clients.nit,
      phone: clients.phone,
      address: clients.address,
      email: clients.email,
    })
    .from(clients)
    .orderBy(asc(clients.name))

  return (
    <div>
      <Header title="Clientes" subtitle={`${rows.length} cliente${rows.length !== 1 ? "s" : ""} registrado${rows.length !== 1 ? "s" : ""}`} />
      <div className="px-4 md:px-6 py-6 max-w-2xl space-y-5">
        <ClientesList initialClients={rows} />
      </div>
    </div>
  )
}
