import { createElement, type ReactElement } from "react"
import type { DocumentProps } from "@react-pdf/renderer"
import type { QuotePDFData, RubroPDFData } from "@/components/cotizaciones/CotizacionPDF"

export type { QuotePDFData, RubroPDFData }

export async function generatePDFBlob(
  quote: QuotePDFData,
  rubros: RubroPDFData[]
): Promise<Blob> {
  const logoSrc = await fetchLogoDataURL()

  const [{ pdf }, { CotizacionPDF }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/cotizaciones/CotizacionPDF"),
  ])

  return pdf(
    createElement(CotizacionPDF, { quote, rubros, logoSrc }) as ReactElement<DocumentProps>
  ).toBlob()
}

export async function sharePDF(blob: Blob, fileName: string): Promise<void> {
  const file = new File([blob], fileName, { type: "application/pdf" })

  const canShare =
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })

  if (canShare) {
    await navigator.share({ files: [file], title: fileName })
  } else {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = fileName
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }
}

async function fetchLogoDataURL(): Promise<string> {
  const res = await fetch("/logo.jpg")
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
