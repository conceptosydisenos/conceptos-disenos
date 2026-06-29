"use client"

import { useRouter } from "next/navigation"
import { Archive, ArchiveRestore } from "lucide-react"

interface Props {
  quoteId:  string
  archived: boolean
}

export function ArchiveQuoteButton({ quoteId, archived }: Props) {
  const router = useRouter()

  function handleClick() {
    router.push("/dashboard/cotizaciones")
    fetch(`/api/cotizaciones/${quoteId}/archivar`, { method: "POST" })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center gap-1.5 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
    >
      {archived
        ? <ArchiveRestore className="w-3.5 h-3.5" />
        : <Archive className="w-3.5 h-3.5" />}
      {archived ? "Desarchivar" : "Archivar cotización"}
    </button>
  )
}
