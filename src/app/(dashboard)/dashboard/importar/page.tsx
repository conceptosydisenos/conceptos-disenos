import { requireRole } from "@/lib/auth"
import { Header } from "@/components/layout/Header"
import { ImportadorForm } from "@/components/importar/ImportadorForm"

export const revalidate = 0

export default async function ImportarPage() {
  await requireRole(["admin"])

  return (
    <div>
      <Header
        title="Importar datos históricos"
        subtitle="Sube tus archivos Excel y la IA clasificará los datos automáticamente"
      />

      <div className="px-4 md:px-6 py-6 max-w-2xl">
        <ImportadorForm />
      </div>
    </div>
  )
}
