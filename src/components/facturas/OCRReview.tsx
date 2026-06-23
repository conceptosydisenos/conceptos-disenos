"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Loader2, AlertTriangle, CheckCircle2, FolderOpen } from "lucide-react"
import type { ExtractedInvoiceData } from "@/lib/gemini"

const schema = z.object({
  invoice_number: z.string().min(1, "Número de factura requerido"),
  supplier_name: z.string().min(1, "Proveedor requerido"),
  supplier_nit: z.string().optional(),
  invoice_date: z.string().min(1, "Fecha requerida"),
  subtotal: z.coerce.number().min(0),
  tax_amount: z.coerce.number().min(0).default(0),
  total_amount: z.coerce.number().positive("El total debe ser mayor a 0"),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface ActiveProject {
  id: string
  name: string
  status: string
}

interface OCRReviewProps {
  imageUrl: string
  ocrData: ExtractedInvoiceData
}

export function OCRReview({ imageUrl, ocrData }: OCRReviewProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [showProjectError, setShowProjectError] = useState(false)
  const [activeProjects, setActiveProjects] = useState<ActiveProject[]>([])
  const projectSectionRef = useRef<HTMLDivElement>(null)

  const confidence = ocrData.confidence ?? 0
  const isLowConfidence = confidence < 0.6

  useEffect(() => {
    fetch("/api/proyectos?status=active")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setActiveProjects(json.data)
      })
      .catch(() => {})
  }, [])

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      invoice_number: ocrData.invoice_number ?? "",
      supplier_name: ocrData.supplier_name ?? "",
      supplier_nit: ocrData.supplier_nit ?? "",
      invoice_date: ocrData.invoice_date ?? "",
      subtotal: ocrData.subtotal || 0,
      tax_amount: ocrData.tax_amount || 0,
      total_amount: ocrData.total_amount || 0,
      notes: "",
    },
  })

  const total = watch("total_amount")

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId)
    setShowProjectError(false)
  }

  const onSubmit = async (values: FormValues) => {
    if (!selectedProjectId) {
      setShowProjectError(true)
      setTimeout(() => {
        projectSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      }, 50)
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch("/api/facturas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          image_url: imageUrl,
          ocr_raw_data: { ...ocrData, items: ocrData.items },
          initial_project_id: selectedProjectId,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      router.push(`/dashboard/facturas/${json.data.id}`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error al guardar")
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* OCR confidence banner */}
      <div
        className={`flex items-start gap-2.5 p-3 rounded-lg border text-sm ${
          isLowConfidence
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : "bg-green-50 border-green-200 text-green-800"
        }`}
      >
        {isLowConfidence ? (
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
        ) : (
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
        )}
        <div>
          <p className="font-medium">
            {isLowConfidence
              ? "Imagen poco legible — verifica los datos"
              : "OCR completado — confirma antes de guardar"}
          </p>
          <p className="text-xs mt-0.5 opacity-75">
            Confianza: {Math.round(confidence * 100)}% · Todos los campos requieren revisión
          </p>
        </div>
        <Badge variant="outline" className="ml-auto shrink-0 text-xs">
          Revisión obligatoria
        </Badge>
      </div>

      {/* Proveedor */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="supplier_name">Proveedor *</Label>
          <Input
            id="supplier_name"
            placeholder="Nombre del proveedor"
            {...register("supplier_name")}
            className={errors.supplier_name ? "border-destructive" : ""}
          />
          {errors.supplier_name && (
            <p className="text-xs text-destructive">{errors.supplier_name.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="supplier_nit">NIT</Label>
          <Input id="supplier_nit" placeholder="800.123.456-7" {...register("supplier_nit")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invoice_number">N° Factura *</Label>
          <Input
            id="invoice_number"
            placeholder="FACT-001"
            {...register("invoice_number")}
            className={errors.invoice_number ? "border-destructive" : ""}
          />
          {errors.invoice_number && (
            <p className="text-xs text-destructive">{errors.invoice_number.message}</p>
          )}
        </div>
      </div>

      {/* Fecha */}
      <div className="space-y-1.5">
        <Label htmlFor="invoice_date">Fecha de factura *</Label>
        <Input
          id="invoice_date"
          type="date"
          {...register("invoice_date")}
          className={errors.invoice_date ? "border-destructive" : ""}
        />
        {errors.invoice_date && (
          <p className="text-xs text-destructive">{errors.invoice_date.message}</p>
        )}
      </div>

      {/* Montos */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Montos (COP)</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="subtotal" className="text-xs text-muted-foreground">
              Subtotal (sin IVA)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input id="subtotal" type="number" min={0} step={1} className="pl-7 tabular-nums" {...register("subtotal")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tax_amount" className="text-xs text-muted-foreground">
              IVA (19%)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input id="tax_amount" type="number" min={0} step={1} className="pl-7 tabular-nums" {...register("tax_amount")} />
            </div>
          </div>
        </div>

        <div className="space-y-1.5 p-3 rounded-lg bg-muted/50 border">
          <Label htmlFor="total_amount" className="text-sm font-semibold">
            Total factura *
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-muted-foreground font-medium">$</span>
            <Input
              id="total_amount"
              type="number"
              min={0}
              step={1}
              className={`pl-7 tabular-nums text-base font-bold ${errors.total_amount ? "border-destructive" : ""}`}
              {...register("total_amount")}
            />
          </div>
          {total > 0 && (
            <p className="text-xs font-medium text-foreground">
              {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(total)}
            </p>
          )}
          {errors.total_amount && (
            <p className="text-xs text-destructive">{errors.total_amount.message}</p>
          )}
        </div>
      </div>

      {/* OCR items (read-only) */}
      {ocrData.items && ocrData.items.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Ítems detectados por OCR ({ocrData.items.length})
          </p>
          <div className="rounded-lg border overflow-hidden">
            {ocrData.items.slice(0, 5).map((item, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 border-b last:border-0 text-sm">
                <span className="text-muted-foreground flex-1 truncate mr-2">{item.description}</span>
                <span className="tabular-nums text-foreground font-medium shrink-0">
                  ${item.total.toLocaleString("es-CO")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notas */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea id="notes" rows={2} placeholder="Observaciones sobre esta factura..." {...register("notes")} />
      </div>

      {/* ── PROYECTO OBLIGATORIO ─────────────────────────────── */}
      <div ref={projectSectionRef} className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">
            Proyecto *
          </Label>
          {selectedProjectId && (
            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Seleccionado
            </span>
          )}
        </div>

        {showProjectError && (
          <div className="rounded-xl border-2 border-emerald-400 bg-emerald-50 p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-emerald-900">
                Para guardar esta factura debes asignarla a una obra. ¿A cuál proyecto pertenece?
              </p>
            </div>
            <ProjectButtons
              projects={activeProjects}
              selectedId={selectedProjectId}
              onSelect={handleProjectSelect}
            />
          </div>
        )}

        {!showProjectError && (
          <ProjectButtons
            projects={activeProjects}
            selectedId={selectedProjectId}
            onSelect={handleProjectSelect}
          />
        )}
      </div>

      {submitError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700">{submitError}</p>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</>
        ) : (
          "Guardar factura →"
        )}
      </Button>
    </form>
  )
}

function ProjectButtons({
  projects,
  selectedId,
  onSelect,
}: {
  projects: ActiveProject[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (projects.length === 0) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border text-sm text-muted-foreground">
        <FolderOpen className="w-4 h-4 shrink-0" />
        <span>No hay proyectos activos</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {projects.map((p) => {
        const isSelected = p.id === selectedId
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            style={{ minHeight: "48px" }}
            className={`w-full flex items-center gap-3 px-4 rounded-xl border-2 text-left transition-all ${
              isSelected
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-background hover:border-primary/50 hover:bg-muted/30"
            }`}
          >
            <FolderOpen className={`w-4 h-4 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
            <span className="text-sm font-medium truncate flex-1">{p.name}</span>
            {isSelected && <CheckCircle2 className="w-4 h-4 shrink-0 text-primary" />}
          </button>
        )
      })}
    </div>
  )
}
