"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, CheckCircle2, Clock, X } from "lucide-react"
import { formatCOP } from "@/lib/utils"

const schema = z.object({
  description: z.string().min(3, "Mínimo 3 caracteres"),
  value: z.coerce.number().positive("El valor debe ser mayor a 0"),
  reason: z.string().min(3, "Explica brevemente el motivo"),
})

type FormValues = z.infer<typeof schema>

interface ProjectExtra {
  id: string
  description: string
  value: string
  reason: string
  status: "pending" | "approved"
  approved_at: string | null
  work_cut_id: string | null
  created_at: string
}

interface ExtrasSectionProps {
  projectId: string
  isAdmin: boolean
  initialExtras: ProjectExtra[]
}

export function ExtrasSection({ projectId, isAdmin, initialExtras }: ExtrasSectionProps) {
  const router = useRouter()
  const [extras, setExtras] = useState<ProjectExtra[]>(initialExtras)
  const [showForm, setShowForm] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    const res = await fetch(`/api/proyectos/${projectId}/extras`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })
    const json = await res.json()
    if (json.success) {
      setExtras((prev) => [json.data, ...prev])
      reset()
      setShowForm(false)
      router.refresh()
    }
  }

  const handleConfirm = async (extraId: string) => {
    setConfirming(extraId)
    try {
      const res = await fetch(`/api/proyectos/${projectId}/extras/${extraId}/confirmar`, {
        method: "POST",
      })
      const json = await res.json()
      if (json.success) {
        setExtras((prev) =>
          prev.map((e) => (e.id === extraId ? { ...e, status: "approved" as const, approved_at: new Date().toISOString() } : e))
        )
        router.refresh()
      }
    } finally {
      setConfirming(null)
    }
  }

  const pendingExtras = extras.filter((e) => e.status === "pending")
  const approvedExtras = extras.filter((e) => e.status === "approved")
  const approvedTotal = approvedExtras.reduce((sum, e) => sum + parseFloat(e.value), 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Adicionales de obra
          {approvedTotal > 0 && (
            <span className="ml-2 text-foreground font-bold normal-case tracking-normal">
              + {formatCOP(approvedTotal)}
            </span>
          )}
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowForm((v) => !v)}
          className="h-7 text-xs"
        >
          {showForm ? <X className="w-3 h-3 mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
          {showForm ? "Cancelar" : "Registrar adicional"}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="section-card space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="extra-desc" className="text-xs">Actividad adicional *</Label>
              <Input
                id="extra-desc"
                placeholder="Ej. Impermeabilización terraza"
                {...register("description")}
                className={errors.description ? "border-destructive" : ""}
                autoFocus
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="extra-value" className="text-xs">Valor (COP) *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  id="extra-value"
                  type="number"
                  min={0}
                  step={1000}
                  className={`pl-7 tabular-nums ${errors.value ? "border-destructive" : ""}`}
                  {...register("value")}
                />
              </div>
              {errors.value && <p className="text-xs text-destructive">{errors.value.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="extra-reason" className="text-xs">Motivo *</Label>
              <Input
                id="extra-reason"
                placeholder="Ej. Daño no visible en cotización inicial"
                {...register("reason")}
                className={errors.reason ? "border-destructive" : ""}
              />
              {errors.reason && <p className="text-xs text-destructive">{errors.reason.message}</p>}
            </div>
            <Button type="submit" size="sm" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Registrar adicional"}
            </Button>
          </form>
        </div>
      )}

      {/* Empty state */}
      {extras.length === 0 && !showForm && (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <p className="text-xs text-muted-foreground">Sin adicionales registrados</p>
        </div>
      )}

      {/* Pending extras */}
      {pendingExtras.length > 0 && (
        <div className="space-y-2">
          {pendingExtras.map((extra) => (
            <div key={extra.id} className="section-card p-3 border-l-4 border-l-emerald-400">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                      <Clock className="w-2.5 h-2.5 mr-1" />
                      Pendiente de confirmar
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-foreground">{extra.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{extra.reason}</p>
                </div>
                <p className="text-sm font-bold tabular-nums text-foreground shrink-0 mt-0.5">
                  {formatCOP(parseFloat(extra.value))}
                </p>
              </div>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 h-8 text-xs w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => handleConfirm(extra.id)}
                  disabled={confirming === extra.id}
                >
                  {confirming === extra.id ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                  )}
                  Confirmar adicional
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Approved extras */}
      {approvedExtras.length > 0 && (
        <div className="space-y-2">
          {approvedExtras.map((extra) => (
            <div key={extra.id} className="section-card p-3 border-l-4 border-l-green-400">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                      <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                      {extra.work_cut_id ? "Incluido en corte" : "Confirmado"}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-foreground">{extra.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{extra.reason}</p>
                </div>
                <p className="text-sm font-bold tabular-nums amount-positive shrink-0 mt-0.5">
                  + {formatCOP(parseFloat(extra.value))}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
