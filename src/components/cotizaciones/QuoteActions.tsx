"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Send, CheckCircle2, FolderPlus, Loader2 } from "lucide-react"

type QuoteStatus = "draft" | "sent" | "approved" | "rejected" | "converted"

interface Props {
  quoteId:     string
  status:      QuoteStatus
  hasRubros:   boolean
  quoteNumber: string
}

export function QuoteActions({ quoteId, status, hasRubros, quoteNumber }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function callAction(action: string) {
    setLoading(action)
    try {
      const res = await fetch(`/api/cotizaciones/${quoteId}/${action}`, { method: "POST" })
      const json = await res.json() as { success: boolean; error?: string; data?: { project_id?: string } }

      if (!json.success) {
        alert(json.error ?? "Error")
        return
      }

      if (action === "convertir" && json.data?.project_id) {
        router.push(`/dashboard/proyectos/${json.data.project_id}`)
        return
      }

      if (action === "enviar") {
        const path = `/dashboard/cotizaciones/${quoteId}/vista-previa`
        const fullUrl = window.location.origin + path

        if (typeof navigator.share === "function") {
          navigator
            .share({ title: `Cotización ${quoteNumber}`, url: fullUrl })
            .catch((err) => {
              if (!(err instanceof Error && err.name === "AbortError")) {
                window.open(path, "_blank")
              }
            })
        } else {
          window.open(path, "_blank")
        }
      }

      router.refresh()
    } finally {
      setLoading(null)
    }
  }

  if (status === "converted" || status === "rejected") return null

  return (
    <div className="section-card space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Acciones</p>

      <div className="space-y-2">
        {status === "draft" && (
          <Button
            className="w-full gap-2"
            onClick={() => callAction("enviar")}
            disabled={loading !== null || !hasRubros}
          >
            {loading === "enviar"
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />}
            Marcar como enviada al cliente
          </Button>
        )}

        {status === "sent" && (
          <Button
            className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => callAction("aprobar")}
            disabled={loading !== null}
          >
            {loading === "aprobar"
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <CheckCircle2 className="w-4 h-4" />}
            El cliente aprobó la cotización
          </Button>
        )}

        {status === "approved" && (
          <>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800 font-medium">
              ¡Cotización aprobada! Convierte a proyecto para iniciar la ejecución.
            </div>
            <Button
              className="w-full gap-2"
              size="lg"
              onClick={() => callAction("convertir")}
              disabled={loading !== null}
            >
              {loading === "convertir"
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <FolderPlus className="w-4 h-4" />}
              Convertir a proyecto
            </Button>
          </>
        )}

        {status === "draft" && !hasRubros && (
          <p className="text-xs text-muted-foreground text-center">
            Agrega al menos un rubro con presupuesto para poder enviar la cotización.
          </p>
        )}
      </div>
    </div>
  )
}
