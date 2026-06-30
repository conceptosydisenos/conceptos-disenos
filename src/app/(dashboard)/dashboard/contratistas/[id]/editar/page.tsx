import { db } from "@/lib/db"
import { contractors } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ContratistasForm } from "@/components/contratistas/ContratistasForm"

export const revalidate = 0

export default async function EditarContratistaPage({ params }: { params: { id: string } }) {
  await requireAuth()

  const [contractor] = await db
    .select({
      id: contractors.id,
      name: contractors.name,
      contractor_type: contractors.contractor_type,
      specialty: contractors.specialty,
      phone: contractors.phone,
      email: contractors.email,
      nit: contractors.nit,
      bank_name: contractors.bank_name,
      bank_account: contractors.bank_account,
    })
    .from(contractors)
    .where(eq(contractors.id, params.id))

  if (!contractor) notFound()

  return (
    <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard/contratistas/${params.id}`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold">Editar contratista</h1>
          <p className="text-sm text-muted-foreground">{contractor.name}</p>
        </div>
      </div>

      <div className="section-card">
        <ContratistasForm
          contratistId={contractor.id}
          defaultValues={{
            name: contractor.name,
            contractor_type: contractor.contractor_type,
            specialty: contractor.specialty,
            phone: contractor.phone,
            email: contractor.email ?? "",
            nit: contractor.nit ?? "",
            bank_name: contractor.bank_name ?? "",
            bank_account: contractor.bank_account ?? "",
          }}
        />
      </div>
    </main>
  )
}
