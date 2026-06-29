"use client"

import { useState } from "react"
import { Download } from "lucide-react"
import { generatePDFBlob, sharePDF } from "@/lib/pdfClient"
import type { QuotePDFData, RubroPDFData } from "@/lib/pdfClient"

interface Props {
  quoteNumber: string
  pdfData:     { quote: QuotePDFData; rubros: RubroPDFData[] }
}

export function PdfDownloadButton({ quoteNumber, pdfData }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (loading) return
    setLoading(true)
    try {
      const fileName = `cotizacion-${quoteNumber.replace(/\//g, "-")}.pdf`
      const blob = await generatePDFBlob(pdfData.quote, pdfData.rubros)
      await sharePDF(blob, fileName)
    } catch (err) {
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
