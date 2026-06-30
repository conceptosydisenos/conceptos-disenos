import { db } from "@/lib/db"
import { clients } from "@/lib/db/schema"
import { requireRole } from "@/lib/auth"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ClientesEditForm } from "@/components/clientes/ClientesEditForm"

export const revalidate = 0

export default async function EditarClientePage({ params }: { params: { id: string } }) {
  await requireRole(["admin"])

  const [client] = await db
    .select({
      id: clients.id,
      name: clients.name,
      nit: clients.nit,
      phone: clients.phone,
      address: clients.address,
      email: clients.email,
    })
    .from(clients)
    .where(eq(clients.id, params.id))

  if (!client) notFound()

  return (
    <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/clientes"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold">Editar cliente</h1>
          <p className="text-sm text-muted-foreground">{client.name}</p>
        </div>
      </div>

      <ClientesEditForm client={client} />
    </main>
  )
}
