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
import { Loader2, AlertTriangle } from "lucide-react"

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

interface FacturaEditFormProps {
  invoiceId: string
  initialValues: FormValues
}

export function FacturaEditForm({ invoiceId, initialValues }: FacturaEditFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  })

  const total = watch("total_amount")

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`/api/facturas/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      router.push(`/dashboard/facturas/${invoiceId}`)
      router.refresh()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error al guardar")
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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

      {/* Notas */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea id="notes" rows={2} placeholder="Observaciones sobre esta factura..." {...register("notes")} />
      </div>

      {submitError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700">{submitError}</p>
        </div>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={submitting}>
          {submitting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</>
          ) : (
            "Guardar cambios"
          )}
        </Button>
      </div>
    </form>
  )
}
