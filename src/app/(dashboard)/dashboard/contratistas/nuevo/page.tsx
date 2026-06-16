import { requireAuth } from "@/lib/auth"
import { ContratistasForm } from "@/components/contratistas/ContratistasForm"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default async function NuevoContratistPage() {
  await requireAuth()

  return (
    <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/contratistas" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold leading-none">Nuevo contratista</h1>
          <p className="text-sm text-muted-foreground">Registra los datos del contratista</p>
        </div>
      </div>
      <ContratistasForm />
    </main>
  )
}
