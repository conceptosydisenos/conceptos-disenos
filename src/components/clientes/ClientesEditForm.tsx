"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, AlertTriangle } from "lucide-react"

const schema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  nit: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
})

type FormValues = z.infer<typeof schema>

interface ClientesEditFormProps {
  client: {
    id: string
    name: string
    nit: string | null
    phone: string | null
    address: string | null
    email: string | null
  }
}

export function ClientesEditForm({ client }: ClientesEditFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: client.name,
      nit: client.nit ?? "",
      phone: client.phone ?? "",
      address: client.address ?? "",
      email: client.email ?? "",
    },
  })

  const onSubmit = async (values: FormValues) => {
    setError(null)
    const res = await fetch(`/api/clientes/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })
    const json = await res.json()
    if (!json.success) {
      setError(json.error ?? "Error al guardar")
      return
    }
    router.push("/dashboard/clientes")
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="section-card space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Nombre / Razón social *</Label>
        <Input
          id="name"
          placeholder="Nombre del cliente o empresa"
          {...register("name")}
          className={errors.name ? "border-destructive" : ""}
          autoFocus
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="nit">Cédula / NIT</Label>
          <Input id="nit" placeholder="800.123.456-7" {...register("nit")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" placeholder="300 000 0000" type="tel" {...register("phone")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">Dirección de obra</Label>
        <Input id="address" placeholder="Calle, barrio, ciudad" {...register("address")} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email (opcional)</Label>
        <Input id="email" placeholder="cliente@email.com" type="email" {...register("email")} />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <><Loader2 className="w-4 h-4 animate-spin mr-2" />Guardando...</>
        ) : (
          "Guardar cambios"
        )}
      </Button>
    </form>
  )
}
