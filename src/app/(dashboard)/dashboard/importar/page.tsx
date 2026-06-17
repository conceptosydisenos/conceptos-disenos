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
        subtitle="Carga tus archivos Excel convertidos a Markdown"
      />

      <div className="px-4 md:px-6 py-6 max-w-2xl">
        <ImportadorForm />
      </div>
    </div>
  )
}
