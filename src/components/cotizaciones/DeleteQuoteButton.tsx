"use client"

import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"

interface Props {
  quoteId: string
}

export function DeleteQuoteButton({ quoteId }: Props) {
  const router = useRouter()

  function handleClick() {
    if (!window.confirm("¿Eliminar esta cotización permanentemente? Esta acción no se puede deshacer.")) return
    router.push("/dashboard/cotizaciones")
    fetch(`/api/cotizaciones/${quoteId}`, { method: "DELETE" })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center gap-1.5 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
    >
      <Trash2 className="w-3.5 h-3.5" />
      Eliminar permanentemente
    </button>
  )
}
