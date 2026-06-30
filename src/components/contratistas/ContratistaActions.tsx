"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { Pencil, Archive, ArchiveRestore, Trash2 } from "lucide-react"

interface ContratistaActionsProps {
  contractorId: string
  isArchived: boolean
}

export function ContratistaActions({ contractorId, isArchived }: ContratistaActionsProps) {
  const router = useRouter()

  const handleArchive = () => {
    router.push("/dashboard/contratistas")
    fetch(`/api/contratistas/${contractorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !isArchived }),
    })
  }

  const handleDelete = () => {
    if (!confirm("¿Eliminar este contratista permanentemente? Esta acción no se puede deshacer.")) return
    fetch(`/api/contratistas/${contractorId}`, { method: "DELETE" })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          router.push("/dashboard/contratistas?ver=archivados")
        } else {
          alert(json.error ?? "Error al eliminar. Recarga la página.")
        }
      })
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {!isArchived && (
        <Link
          href={`/dashboard/contratistas/${contractorId}/editar`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Editar
        </Link>
      )}
      <button
        type="button"
        onClick={handleArchive}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        {isArchived ? (
          <><ArchiveRestore className="w-3.5 h-3.5" />Desarchivar</>
        ) : (
          <><Archive className="w-3.5 h-3.5" />Archivar</>
        )}
      </button>
      {isArchived && (
        <button
          type="button"
          onClick={handleDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/30 text-xs font-medium text-destructive hover:bg-destructive/5 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Eliminar
        </button>
      )}
    </div>
  )
}
