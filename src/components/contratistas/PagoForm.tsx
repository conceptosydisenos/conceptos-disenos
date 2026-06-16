"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react"

const schema = z.object({
  project_id: z.string().uuid("Selecciona un proyecto"),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  payment_date: z.string().min(1, "Fecha requerida"),
  payment_method: z.enum(["transferencia", "efectivo", "cheque"]),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
  already_paid: z.boolean().default(true),
})

type FormValues = z.infer<typeof schema>

interface ProjectOption {
  pc_id: string
  project_id: string
  project_name: string | null
  contract_amount: string
  balance: number
}

interface PagoFormProps {
  contractorId: string
  contractorName: string
  projects: ProjectOption[]
}

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
})

export function PagoForm({ contractorId, contractorName, projects }: PagoFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      payment_date: new Date().toISOString().slice(0, 10),
      payment_method: "transferencia",
      already_paid: true,
    },
  })

  const selectedProjectId = watch("project_id")
  const alreadyPaid = watch("already_paid")
  const amount = watch("amount")

  const selectedProject = projects.find((p) => p.project_id === selectedProjectId)

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/pagos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, contractor_id: contractorId }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      router.push(`/dashboard/contratistas/${contractorId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar pago")
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Contratista header */}
      <div className="p-3 rounded-xl border bg-muted/30">
        <p className="text-xs text-muted-foreground">Pago para</p>
        <p className="text-sm font-bold">{contractorName}</p>
      </div>

      {/* Project selection */}
      <div className="space-y-1.5">
        <Label>Proyecto *</Label>
        <Select
          onValueChange={(val) => setValue("project_id", val)}
        >
          <SelectTrigger className={errors.project_id ? "border-destructive" : ""}>
            <SelectValue placeholder="Seleccionar proyecto..." />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.project_id} value={p.project_id}>
                <div>
                  <p className="text-sm">{p.project_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Saldo: {COP.format(p.balance)}
                  </p>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.project_id && <p className="text-xs text-destructive">{errors.project_id.message}</p>}
        {selectedProject && (
          <p className="text-xs text-muted-foreground">
            Contratado: {COP.format(parseFloat(selectedProject.contract_amount))} · Saldo: {COP.format(selectedProject.balance)}
          </p>
        )}
      </div>

      {/* Amount */}
      <div className="space-y-1.5">
        <Label htmlFor="amount">Monto (COP) *</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input
            id="amount"
            type="number"
            min={0}
            step={10000}
            placeholder="0"
            className={`pl-7 tabular-nums text-base font-bold ${errors.amount ? "border-destructive" : ""}`}
            {...register("amount")}
          />
        </div>
        {amount > 0 && (
          <p className="text-xs text-muted-foreground">{COP.format(amount)}</p>
        )}
        {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
      </div>

      {/* Date + method */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="payment_date" className="text-xs">Fecha</Label>
          <Input
            id="payment_date"
            type="date"
            {...register("payment_date")}
            className={errors.payment_date ? "border-destructive" : ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Método</Label>
          <Select
            defaultValue="transferencia"
            onValueChange={(v) => setValue("payment_method", v as FormValues["payment_method"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="transferencia">Transferencia</SelectItem>
              <SelectItem value="efectivo">Efectivo</SelectItem>
              <SelectItem value="cheque">Cheque</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Reference */}
      <div className="space-y-1.5">
        <Label htmlFor="reference_number">N° de referencia (opcional)</Label>
        <Input id="reference_number" placeholder="Comprobante de transferencia..." {...register("reference_number")} />
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Observaciones (opcional)</Label>
        <Textarea id="notes" rows={2} placeholder="Quincena del 1 al 15..." {...register("notes")} />
      </div>

      {/* Already paid toggle */}
      <button
        type="button"
        onClick={() => setValue("already_paid", !alreadyPaid)}
        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
          alreadyPaid
            ? "border-green-300 bg-green-50"
            : "border-border bg-background hover:bg-muted/30"
        }`}
      >
        <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${alreadyPaid ? "bg-green-500" : "border-2 border-muted-foreground"}`}>
          {alreadyPaid && <CheckCircle2 className="w-4 h-4 text-white" />}
        </div>
        <div>
          <p className="text-sm font-medium">{alreadyPaid ? "Ya fue pagado" : "Programar como pendiente"}</p>
          <p className="text-xs text-muted-foreground">
            {alreadyPaid ? "El pago se registra como completado" : "Aparecerá en pendientes de esta quincena"}
          </p>
        </div>
      </button>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</>
        ) : alreadyPaid ? (
          "Registrar pago"
        ) : (
          "Programar pago"
        )}
      </Button>
    </form>
  )
}
