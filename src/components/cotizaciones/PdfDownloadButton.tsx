"use client"

import { Download } from "lucide-react"

interface Props {
  quoteId:     string
  quoteNumber: string
}

export function PdfDownloadButton({ quoteId, quoteNumber }: Props) {
  function handleClick() {
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

  return (
    <button
      type="button"
      onClick={handleClick}
      className="shrink-0 mt-0.5 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors font-medium whitespace-nowrap"
      aria-label="Ver PDF"
    >
      <Download className="w-3.5 h-3.5" />
      PDF
    </button>
  )
}
