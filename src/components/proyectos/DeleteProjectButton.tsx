"use client"

import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"

interface Props {
  projectId: string
}

export function DeleteProjectButton({ projectId }: Props) {
  const router = useRouter()

  function handleClick() {
    if (!window.confirm("¿Eliminar este proyecto permanentemente? Esta acción no se puede deshacer.")) return
    router.push("/dashboard/proyectos")
    fetch(`/api/proyectos/${projectId}`, { method: "DELETE" })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 border border-destructive/30 rounded-lg transition-colors"
    >
      <Trash2 className="w-3.5 h-3.5" />
      Eliminar permanentemente
    </button>
  )
}
