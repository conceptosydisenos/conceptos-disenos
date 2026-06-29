"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Archive, ArchiveRestore, Loader2 } from "lucide-react"

interface Props {
  quoteId:  string
  archived: boolean
}

export function ArchiveQuoteButton({ quoteId, archived }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      await fetch(`/api/cotizaciones/${quoteId}/archivar`, { method: "POST" })
      router.push("/dashboard/cotizaciones")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1.5 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
    >
      {loading
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : archived
          ? <ArchiveRestore className="w-3.5 h-3.5" />
          : <Archive className="w-3.5 h-3.5" />}
      {archived ? "Desarchivar" : "Archivar cotización"}
    </button>
  )
}
