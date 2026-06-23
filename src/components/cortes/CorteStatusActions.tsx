"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, Send, CheckCircle2 } from "lucide-react"

interface CorteStatusActionsProps {
  cutId: string
  projectId: string
  currentStatus: string
  isAdmin: boolean
}

export function CorteStatusActions({ cutId, projectId: _projectId, currentStatus, isAdmin }: CorteStatusActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Optimistic status prevents double-click while router.refresh() is in flight
  const [optimisticStatus, setOptimisticStatus] = useState(currentStatus)

  const transition = async (endpoint: string, nextStatus: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/cortes/${cutId}/${endpoint}`, { method: "POST" })
      const json = await res.json() as { success: boolean; error?: string }
      if (!json.success) throw new Error(json.error)
      setOptimisticStatus(nextStatus)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      {optimisticStatus === "draft" && (
        <Button
          className="w-full gap-2"
          variant="outline"
          disabled={loading}
          onClick={() => transition("submit", "submitted")}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Enviar al cliente
        </Button>
      )}

      {optimisticStatus === "submitted" && isAdmin && (
        <Button
          className="w-full gap-2 bg-green-600 hover:bg-green-700"
          disabled={loading}
          onClick={() => transition("aprobar", "approved")}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          Aprobar corte
        </Button>
      )}

      {optimisticStatus === "submitted" && !isAdmin && (
        <p className="text-xs text-center text-muted-foreground">
          Esperando aprobación de la administración
        </p>
      )}
    </div>
  )
}
