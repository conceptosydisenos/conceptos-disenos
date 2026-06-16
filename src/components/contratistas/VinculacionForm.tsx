"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, AlertTriangle } from "lucide-react"
import type { Project } from "@/types"

const schema = z.object({
  project_id: z.string().uuid("Selecciona un proyecto"),
  contract_amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  start_date: z.string().min(1, "Fecha de inicio requerida"),
  end_date: z.string().optional(),
  payment_modality: z.enum(["quincenal", "por_actividad"]),
})

type FormValues = z.infer<typeof schema>

interface VinculacionFormProps {
  contractorId: string
  contractorName: string
  availableProjects: Pick<Project, "id" | "name">[]
}

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
})

export function VinculacionForm({ contractorId, contractorName, availableProjects }: VinculacionFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      payment_modality: "quincenal",
      start_date: new Date().toISOString().slice(0, 10),
    },
  })

  const amount = watch("contract_amount")

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/contratistas/${contractorId}/proyectos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      router.push(`/dashboard/contratistas/${contractorId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al vincular")
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="p-3 rounded-xl border bg-muted/30">
        <p className="text-xs text-muted-foreground">Vinculando a</p>
        <p className="text-sm font-bold">{contractorName}</p>
      </div>

      <div className="space-y-1.5">
        <Label>Proyecto *</Label>
        <Select onValueChange={(v) => setValue("project_id", v)}>
          <SelectTrigger className={errors.project_id ? "border-destructive" : ""}>
            <SelectValue placeholder="Seleccionar proyecto..." />
          </SelectTrigger>
          <SelectContent>
            {availableProjects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.project_id && <p className="text-xs text-destructive">{errors.project_id.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contract_amount">Valor contratado (COP) *</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input
            id="contract_amount"
            type="number"
            min={0}
            step={100000}
            placeholder="0"
            className={`pl-7 tabular-nums font-bold ${errors.contract_amount ? "border-destructive" : ""}`}
            {...register("contract_amount")}
          />
        </div>
        {amount > 0 && <p className="text-xs text-muted-foreground">{COP.format(amount)}</p>}
        {errors.contract_amount && <p className="text-xs text-destructive">{errors.contract_amount.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Modalidad de pago *</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["quincenal", "por_actividad"] as const).map((m) => {
            const current = watch("payment_modality")
            return (
              <button
                key={m}
                type="button"
                onClick={() => setValue("payment_modality", m)}
                className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                  current === m
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {m === "quincenal" ? "Quincenal" : "Por actividad"}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="start_date" className="text-xs">Inicio</Label>
          <Input id="start_date" type="date" {...register("start_date")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="end_date" className="text-xs">Fin (opcional)</Label>
          <Input id="end_date" type="date" {...register("end_date")} />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Vinculando...</>
        ) : (
          "Vincular a proyecto"
        )}
      </Button>
    </form>
  )
}
