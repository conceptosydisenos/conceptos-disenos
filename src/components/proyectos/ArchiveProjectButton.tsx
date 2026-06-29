"use client"

import { useRouter } from "next/navigation"
import { Archive, ArchiveRestore } from "lucide-react"

interface Props {
  projectId: string
  archived:  boolean
}

export function ArchiveProjectButton({ projectId, archived }: Props) {
  const router = useRouter()

  function handleClick() {
    router.push("/dashboard/proyectos")
    fetch(`/api/proyectos/${projectId}/archivar`, { method: "POST" })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors"
    >
      {archived
        ? <ArchiveRestore className="w-3.5 h-3.5" />
        : <Archive className="w-3.5 h-3.5" />}
      {archived ? "Desarchivar" : "Archivar"}
    </button>
  )
}
