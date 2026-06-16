"use client"

import { useRef, useState } from "react"
import { Camera, ImagePlus, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ExtractedInvoiceData } from "@/lib/gemini"

interface CameraCaptureProps {
  onComplete: (imageUrl: string, ocrData: ExtractedInvoiceData) => void
}

type Step = "idle" | "compressing" | "uploading" | "ocr"

const STEP_LABELS: Record<Step, string> = {
  idle: "",
  compressing: "Optimizando imagen...",
  uploading: "Subiendo factura...",
  ocr: "Analizando con Gemini...",
}

async function compressToWebP(file: File, maxSizeMB = 2): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (!ctx) { reject(new Error("Canvas not supported")); return }

      const MAX_DIM = 2000
      let { naturalWidth: w, naturalHeight: h } = img
      if (w > MAX_DIM || h > MAX_DIM) {
        if (w >= h) { h = Math.round((h / w) * MAX_DIM); w = MAX_DIM }
        else { w = Math.round((w / h) * MAX_DIM); h = MAX_DIM }
      }
      canvas.width = w
      canvas.height = h
      ctx.drawImage(img, 0, 0, w, h)

      const toBlob = (format: string, quality: number) =>
        new Promise<Blob | null>((res) => canvas.toBlob(res, format, quality))

      const compress = async () => {
        const maxBytes = maxSizeMB * 1024 * 1024
        let blob = await toBlob("image/webp", 0.85)
        // Fallback: some iOS versions return null for webp encoding
        if (!blob || blob.size === 0) blob = await toBlob("image/jpeg", 0.85)
        let quality = 0.75
        while (blob && blob.size > maxBytes && quality > 0.35) {
          blob = (await toBlob("image/webp", quality)) ?? (await toBlob("image/jpeg", quality))
          quality -= 0.1
        }
        if (!blob) throw new Error("No se pudo comprimir la imagen")
        const ext = blob.type === "image/webp" ? ".webp" : ".jpg"
        return new File([blob], `factura${ext}`, { type: blob.type })
      }

      compress().then(resolve).catch(reject)
    }

    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Error al cargar imagen")) }
    img.src = objectUrl
  })
}

export function CameraCapture({ onComplete }: CameraCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>("idle")
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setError(null)
    setPreview(URL.createObjectURL(file))

    try {
      // 1. Compress
      setStep("compressing")
      const compressed = await compressToWebP(file)

      // 2. Upload to Vercel Blob
      setStep("uploading")
      const form = new FormData()
      form.append("file", compressed)
      const uploadRes = await fetch("/api/uploads", { method: "POST", body: form })
      const uploadJson = await uploadRes.json()
      if (!uploadJson.success) throw new Error(uploadJson.error ?? "Error al subir imagen")
      const { url: imageUrl } = uploadJson.data

      // 3. OCR with Gemini
      setStep("ocr")
      const ocrRes = await fetch("/api/facturas/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: imageUrl }),
      })
      const ocrJson = await ocrRes.json()
      // OCR failure is non-blocking — we show empty fields for manual entry
      const ocrData = ocrJson.success
        ? ocrJson.data
        : {
            invoice_number: null, supplier_name: null, supplier_nit: null,
            invoice_date: null, subtotal: 0, tax_amount: 0, total_amount: 0,
            items: [], confidence: 0, requires_review: true as const,
          }

      onComplete(imageUrl, ocrData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar la imagen")
      setStep("idle")
    }
  }

  const isProcessing = step !== "idle"

  return (
    <div className="space-y-5">
      {/* Preview */}
      {preview && (
        <div className="relative rounded-xl overflow-hidden bg-muted aspect-[4/3]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Vista previa" className="w-full h-full object-cover" />
          {isProcessing && (
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
              <p className="text-sm text-white font-medium">{STEP_LABELS[step]}</p>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-px" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Buttons */}
      {!isProcessing && (
        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="h-20 flex-col gap-2 bg-primary hover:bg-primary/90"
          >
            <Camera className="w-6 h-6" />
            <span className="text-sm">Tomar foto</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.removeAttribute("capture")
                inputRef.current.click()
                // Re-add capture after dialog opens (slight delay)
                setTimeout(() => inputRef.current?.setAttribute("capture", "environment"), 500)
              }
            }}
            className="h-20 flex-col gap-2"
          >
            <ImagePlus className="w-6 h-6" />
            <span className="text-sm">Galería</span>
          </Button>
        </div>
      )}

      {/* Hidden file input — capture="environment" for rear camera */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,image/heic,image/heif"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          // Reset so same file can be re-selected
          e.target.value = ""
        }}
      />

      {!preview && !isProcessing && (
        <p className="text-xs text-muted-foreground text-center">
          La imagen se comprime automáticamente · Máximo 2MB
        </p>
      )}
    </div>
  )
}
