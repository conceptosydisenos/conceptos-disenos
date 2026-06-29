"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Archive, ArchiveRestore, Loader2 } from "lucide-react"

interface Props {
  projectId: string
  archived:  boolean
}

export function ArchiveProjectButton({ projectId, archived }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      await fetch(`/api/proyectos/${projectId}/archivar`, { method: "POST" })
      router.push("/dashboard/proyectos")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
    >
      {loading
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : archived
          ? <ArchiveRestore className="w-3.5 h-3.5" />
          : <Archive className="w-3.5 h-3.5" />}
      {archived ? "Desarchivar" : "Archivar"}
    </button>
  )
}
