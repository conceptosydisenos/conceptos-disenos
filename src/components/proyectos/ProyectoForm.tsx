"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
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
import { Loader2, Plus, UserPlus } from "lucide-react"

const schema = z.object({
  client_id: z.string().min(1, "Selecciona un cliente"),
  name: z.string().min(3, "Mínimo 3 caracteres"),
  description: z.string().optional(),
  quoted_amount: z.coerce
    .number({ invalid_type_error: "Ingresa el valor" })
    .positive("El valor debe ser mayor a 0"),
  advance_percentage: z.coerce.number().min(0).max(100),
  contingency_percentage: z.coerce.number().min(0).max(100),
  start_date: z.string().min(1, "Selecciona una fecha"),
  estimated_end_date: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Client {
  id: string
  name: string
  nit: string | null
}

interface ProyectoFormProps {
  clients: Client[]
  projectId?: string
  initialValues?: Partial<FormValues>
}

export function ProyectoForm({ clients, projectId, initialValues }: ProyectoFormProps) {
  const router = useRouter()
  const isEditing = Boolean(projectId)
  const [newClientName, setNewClientName] = useState("")
  const [showNewClient, setShowNewClient] = useState(false)
  const [creatingClient, setCreatingClient] = useState(false)
  const [clientList, setClientList] = useState<Client[]>(clients)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      advance_percentage: 50,
      contingency_percentage: 15,
      ...initialValues,
    },
  })

  const quotedAmount = watch("quoted_amount")

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return
    setCreatingClient(true)
    try {
      const res = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newClientName.trim() }),
      })
      const json = await res.json()
      if (json.success) {
        const newClient = { id: json.data.id, name: json.data.name, nit: json.data.nit }
        setClientList((prev) => [...prev, newClient])
        setValue("client_id", newClient.id)
        setNewClientName("")
        setShowNewClient(false)
      }
    } finally {
      setCreatingClient(false)
    }
  }

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null)
    const url = isEditing ? `/api/proyectos/${projectId}` : "/api/proyectos"
    const method = isEditing ? "PATCH" : "POST"
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      const json = await res.json()
      if (json.success) {
        const dest = isEditing ? `/dashboard/proyectos/${projectId}` : `/dashboard/proyectos/${json.data.id}`
        router.push(dest)
        router.refresh()
      } else {
        setSubmitError(json.error ?? "Error al guardar. Intenta de nuevo.")
      }
    } catch {
      setSubmitError("Error de conexión. Verifica tu red e intenta de nuevo.")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Cliente */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="client_id">Cliente *</Label>
          <button
            type="button"
            onClick={() => setShowNewClient((v) => !v)}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <UserPlus className="w-3 h-3" />
            Nuevo cliente
          </button>
        </div>

        {showNewClient ? (
          <div className="flex gap-2">
            <Input
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              placeholder="Nombre del cliente"
              className="flex-1"
              autoFocus
            />
            <Button
              type="button"
              size="sm"
              onClick={handleCreateClient}
              disabled={creatingClient || !newClientName.trim()}
            >
              {creatingClient ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>
        ) : (
          <Select value={watch("client_id") || undefined} onValueChange={(v) => setValue("client_id", v)}>
            <SelectTrigger id="client_id" className={errors.client_id ? "border-destructive" : ""}>
              <SelectValue placeholder="Seleccionar cliente" />
            </SelectTrigger>
            <SelectContent>
              {clientList.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                  No hay clientes — crea uno arriba
                </div>
              ) : (
                clientList.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.nit && <span className="text-muted-foreground ml-1">· {c.nit}</span>}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}
        {errors.client_id && (
          <p className="text-xs text-destructive">{errors.client_id.message}</p>
        )}
      </div>

      {/* Nombre del proyecto */}
      <div className="space-y-1.5">
        <Label htmlFor="name">Nombre del proyecto *</Label>
        <Input
          id="name"
          placeholder="Ej. Remodelación apartamento Chapinero"
          {...register("name")}
          className={errors.name ? "border-destructive" : ""}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      {/* Descripción */}
      <div className="space-y-1.5">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          placeholder="Alcance del proyecto, observaciones..."
          rows={3}
          {...register("description")}
        />
      </div>

      {/* Valor cotizado */}
      <div className="space-y-1.5">
        <Label htmlFor="quoted_amount">Valor cotizado (COP) *</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
          <Input
            id="quoted_amount"
            type="number"
            min={0}
            step={1}
            placeholder="0"
            className={`pl-7 tabular-nums ${errors.quoted_amount ? "border-destructive" : ""}`}
            {...register("quoted_amount")}
          />
        </div>
        {quotedAmount > 0 && (
          <p className="text-xs text-muted-foreground">
            {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(quotedAmount)}
          </p>
        )}
        {errors.quoted_amount && (
          <p className="text-xs text-destructive">{errors.quoted_amount.message}</p>
        )}
      </div>

      {/* Porcentajes en grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="advance_percentage">Anticipo (%)</Label>
          <div className="relative">
            <Input
              id="advance_percentage"
              type="number"
              min={0}
              max={100}
              step={5}
              className="tabular-nums"
              {...register("advance_percentage")}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contingency_percentage">Imprevistos (%)</Label>
          <div className="relative">
            <Input
              id="contingency_percentage"
              type="number"
              min={0}
              max={100}
              step={1}
              className="tabular-nums"
              {...register("contingency_percentage")}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
          </div>
        </div>
      </div>

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="start_date">Fecha inicio *</Label>
          <Input
            id="start_date"
            type="date"
            {...register("start_date")}
            className={errors.start_date ? "border-destructive" : ""}
          />
          {errors.start_date && (
            <p className="text-xs text-destructive">{errors.start_date.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="estimated_end_date">Entrega estimada</Label>
          <Input id="estimated_end_date" type="date" {...register("estimated_end_date")} />
        </div>
      </div>

      {/* Submit error */}
      {submitError && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{submitError}</p>
      )}

      {/* Submit */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {isEditing ? "Guardando..." : "Creando..."}
            </>
          ) : isEditing ? (
            "Guardar cambios"
          ) : (
            "Crear proyecto"
          )}
        </Button>
      </div>
    </form>
  )
}
