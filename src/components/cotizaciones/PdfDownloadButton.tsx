"use client"

import { useState } from "react"
import { Download } from "lucide-react"

interface Props {
  quoteId: string
  quoteNumber: string
}

export function PdfDownloadButton({ quoteId, quoteNumber }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (loading) return
    setLoading(true)

    try {
      const res = await fetch(`/api/cotizaciones/${quoteId}/pdf`)
      if (!res.ok) throw new Error("Error al generar PDF")

      const blob = await res.blob()
      const fileName = `cotizacion-${quoteNumber.replace(/\//g, "-")}.pdf`
      const file = new File([blob], fileName, { type: "application/pdf" })

      // Mobile: use Web Share API if available and supports files
      const canShare =
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })

      if (canShare) {
        await navigator.share({
          files: [file],
          title: `Cotización ${quoteNumber}`,
        })
      } else {
        // Desktop: open in new tab so the browser shows the PDF inline
        const url = URL.createObjectURL(blob)
        window.open(url, "_blank")
        setTimeout(() => URL.revokeObjectURL(url), 30_000)
      }
    } catch (err) {
      // AbortError = user cancelled the share sheet — silent
      if (err instanceof Error && err.name === "AbortError") return
      console.error("PDF error:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="shrink-0 mt-0.5 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors font-medium disabled:opacity-50 whitespace-nowrap"
      aria-label="Descargar PDF"
    >
      <Download className="w-3.5 h-3.5" />
      {loading ? "Generando…" : "PDF"}
    </button>
  )
}
