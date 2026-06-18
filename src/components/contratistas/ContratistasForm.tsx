"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useEffect, useState } from "react"
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

const SPECIALTIES = [
  "Obra negra",
  "Acabados",
  "Carpintería",
  "Vidrios y ventanas",
  "Instalaciones eléctricas",
  "Instalaciones hidráulicas",
  "Pintura",
  "Pisos y enchapes",
  "Estructuras metálicas",
  "Impermeabilización",
  "Cielos rasos",
  "Jardines y exteriores",
]

const schema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  contractor_type: z.enum(["persona_natural", "empresa"]),
  specialty: z.string().min(1, "Especialidad requerida"),
  phone: z.string().min(7, "Teléfono requerido"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  nit: z.string().optional(),
  bank_name: z.string().optional(),
  bank_account: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface ContratistasFormProps {
  defaultValues?: Partial<FormValues>
  contratistId?: string
}

export function ContratistasForm({ defaultValues, contratistId }: ContratistasFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEditing = Boolean(contratistId)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      contractor_type: "persona_natural",
      phone: "+57 ",
      ...defaultValues,
    },
  })

  const contractorType = watch("contractor_type")
  const phoneValue = watch("phone")

  useEffect(() => {
    const PREFIX = "+57 "
    if (phoneValue !== undefined && !phoneValue.startsWith(PREFIX)) {
      const digits = phoneValue.replace(/^\+?57\s?/, "")
      setValue("phone", PREFIX + digits, { shouldValidate: false })
    }
  }, [phoneValue, setValue])

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true)
    setError(null)
    try {
      const url = isEditing ? `/api/contratistas/${contratistId}` : "/api/contratistas"
      const method = isEditing ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      if (isEditing) {
        router.push(`/dashboard/contratistas/${contratistId}`)
      } else {
        router.push(`/dashboard/contratistas/${json.data.id}`)
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar")
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Type */}
      <div className="space-y-1.5">
        <Label>Tipo de persona *</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["persona_natural", "empresa"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setValue("contractor_type", type)}
              className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                contractorType === type
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {type === "persona_natural" ? "Persona natural" : "Empresa"}
            </button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="name">
          {contractorType === "persona_natural" ? "Nombre completo *" : "Razón social *"}
        </Label>
        <Input
          id="name"
          placeholder={contractorType === "persona_natural" ? "Ej. Juan Carlos Pérez" : "Ej. Construcciones ABC S.A.S."}
          {...register("name")}
          className={errors.name ? "border-destructive" : ""}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      {/* NIT / Cédula */}
      <div className="space-y-1.5">
        <Label htmlFor="nit">
          {contractorType === "persona_natural" ? "Cédula" : "NIT"}
        </Label>
        <Input
          id="nit"
          placeholder={contractorType === "persona_natural" ? "1.023.456.789" : "900.123.456-7"}
          {...register("nit")}
        />
      </div>

      {/* Phone */}
      <div className="space-y-1.5">
        <Label htmlFor="phone">Teléfono *</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+57 300 123 4567"
          {...register("phone")}
          className={errors.phone ? "border-destructive" : ""}
          onFocus={(e) => {
            if (!e.target.value) setValue("phone", "+57 ")
          }}
        />
        {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email (opcional)</Label>
        <Input id="email" type="email" placeholder="contratista@email.com" {...register("email")} />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      {/* Specialty */}
      <div className="space-y-1.5">
        <Label htmlFor="specialty">Especialidad *</Label>
        <Input
          id="specialty"
          list="specialty-options"
          placeholder="Ej. Obra negra, Acabados..."
          {...register("specialty")}
          className={errors.specialty ? "border-destructive" : ""}
        />
        <datalist id="specialty-options">
          {SPECIALTIES.map((s) => <option key={s} value={s} />)}
        </datalist>
        {errors.specialty && <p className="text-xs text-destructive">{errors.specialty.message}</p>}
      </div>

      {/* Banking */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Datos bancarios (para transferencias)</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="bank_name" className="text-xs">Banco</Label>
            <Input id="bank_name" placeholder="Bancolombia" {...register("bank_name")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bank_account" className="text-xs">N° de cuenta</Label>
            <Input id="bank_account" placeholder="69012345678" {...register("bank_account")} />
          </div>
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
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</>
        ) : isEditing ? (
          "Guardar cambios"
        ) : (
          "Crear contratista"
        )}
      </Button>
    </form>
  )
}
