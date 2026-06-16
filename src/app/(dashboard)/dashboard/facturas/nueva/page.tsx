"use client"

import { useState } from "react"
import { CameraCapture } from "@/components/facturas/CameraCapture"
import { OCRReview } from "@/components/facturas/OCRReview"
import type { ExtractedInvoiceData } from "@/lib/gemini"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

type FlowStep = "capture" | "review"

export default function NuevaFacturaPage() {
  const [step, setStep] = useState<FlowStep>("capture")
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [ocrData, setOcrData] = useState<ExtractedInvoiceData | null>(null)

  const handleCaptureComplete = (url: string, data: ExtractedInvoiceData) => {
    setImageUrl(url)
    setOcrData(data)
    setStep("review")
  }

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        {step === "review" ? (
          <button
            type="button"
            onClick={() => setStep("capture")}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 -m-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <Link href="/dashboard/facturas" className="text-muted-foreground hover:text-foreground transition-colors p-1 -m-1">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        )}
        <div>
          <h1 className="text-lg font-bold">
            {step === "capture" ? "Fotografiar factura" : "Revisar datos"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {step === "capture"
              ? "Toma una foto clara de la factura"
              : "Verifica y corrige los datos antes de guardar"}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        <div className={`h-1.5 rounded-full flex-1 transition-colors ${step === "capture" ? "bg-primary" : "bg-primary/30"}`} />
        <div className={`h-1.5 rounded-full flex-1 transition-colors ${step === "review" ? "bg-primary" : "bg-muted"}`} />
      </div>

      {/* Content */}
      {step === "capture" && <CameraCapture onComplete={handleCaptureComplete} />}

      {step === "review" && imageUrl && ocrData && (
        <div className="space-y-4">
          {/* Preview thumbnail */}
          <div className="rounded-lg overflow-hidden border aspect-video bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Factura" className="w-full h-full object-contain" />
          </div>
          <OCRReview imageUrl={imageUrl} ocrData={ocrData} />
        </div>
      )}
    </div>
  )
}
