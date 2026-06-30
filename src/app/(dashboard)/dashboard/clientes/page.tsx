import { db } from "@/lib/db"
import { clients } from "@/lib/db/schema"
import { requireRole } from "@/lib/auth"
import { Header } from "@/components/layout/Header"
import { asc, eq, count } from "drizzle-orm"
import { ClientesList } from "@/components/clientes/ClientesList"
import Link from "next/link"
import { Archive } from "lucide-react"

export const revalidate = 0

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: { ver?: string }
}) {
  await requireRole(["admin"])

  const showArchived = searchParams.ver === "archivados"

  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      nit: clients.nit,
      phone: clients.phone,
      address: clients.address,
      email: clients.email,
      archived: clients.archived,
    })
    .from(clients)
    .where(eq(clients.archived, showArchived))
    .orderBy(asc(clients.name))

  const [{ total: archivedCount }] = await db
    .select({ total: count() })
    .from(clients)
    .where(eq(clients.archived, true))

  const subtitle = showArchived
    ? `${rows.length} archivado${rows.length !== 1 ? "s" : ""}`
    : `${rows.length} cliente${rows.length !== 1 ? "s" : ""} activo${rows.length !== 1 ? "s" : ""}`

  return (
    <div>
      <Header title="Clientes" subtitle={subtitle} />
      <div className="px-4 md:px-6 py-6 max-w-2xl space-y-5">
        {showArchived && (
          <Link
            href="/dashboard/clientes"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Volver a clientes activos
          </Link>
        )}

        <ClientesList
          key={showArchived ? "archived" : "active"}
          initialClients={rows}
          showArchived={showArchived}
        />

        {!showArchived && archivedCount > 0 && (
          <Link
            href="/dashboard/clientes?ver=archivados"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Archive className="w-4 h-4" />
            Ver {archivedCount} archivado{archivedCount !== 1 ? "s" : ""}
          </Link>
        )}
      </div>
    </div>
  )
}
