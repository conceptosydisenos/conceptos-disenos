"use client"

import { Download } from "lucide-react"

interface Props {
  quoteId: string
}

export function PdfDownloadButton({ quoteId }: Props) {
  return (
    <button
      type="button"
      onClick={() => window.open(`/cotizaciones/${quoteId}/vista-previa`, "_blank")}
      className="shrink-0 mt-0.5 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors font-medium whitespace-nowrap"
      aria-label="Ver cotización en PDF"
    >
      <Download className="w-3.5 h-3.5" />
      PDF
    </button>
  )
}
