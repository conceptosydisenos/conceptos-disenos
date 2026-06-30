"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Loader2,
  Plus,
  UserRound,
  Phone,
  MapPin,
  Hash,
  ChevronDown,
  ChevronUp,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
} from "lucide-react"
import Link from "next/link"

const schema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  nit: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
})

type FormValues = z.infer<typeof schema>

interface Cliente {
  id: string
  name: string
  nit: string | null
  phone: string | null
  address: string | null
  email: string | null
  archived: boolean
}

interface ClientesListProps {
  initialClients: Cliente[]
  showArchived: boolean
}

export function ClientesList({ initialClients, showArchived }: ClientesListProps) {
  const router = useRouter()
  const [clients, setClients] = useState<Cliente[]>(initialClients)
  const [showForm, setShowForm] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    const res = await fetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })
    const json = await res.json()
    if (json.success) {
      setClients((prev) =>
        [...prev, { ...json.data, archived: false }].sort((a, b) => a.name.localeCompare(b.name))
      )
      reset()
      setShowForm(false)
      router.refresh()
    }
  }

  const handleArchive = (id: string, archive: boolean) => {
    setClients((prev) => prev.filter((c) => c.id !== id))
    fetch(`/api/clientes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: archive }),
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm("¿Eliminar este cliente permanentemente? Esta acción no se puede deshacer.")) return
    setClients((prev) => prev.filter((c) => c.id !== id))
    fetch(`/api/clientes/${id}`, { method: "DELETE" }).then((r) => r.json()).then((json) => {
      if (!json.success) {
        alert(json.error ?? "Error al eliminar. Recarga la página.")
        router.refresh()
      }
    })
  }

  const toggleForm = () => {
    setShowForm((v) => !v)
    if (!showForm) {
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100)
    }
  }

  return (
    <div className="space-y-4">
      {/* Add button — only in active view */}
      {!showArchived && (
        <Button onClick={toggleForm} variant={showForm ? "outline" : "default"} className="w-full sm:w-auto">
          {showForm ? (
            <><ChevronUp className="w-4 h-4 mr-2" />Cancelar</>
          ) : (
            <><Plus className="w-4 h-4 mr-2" />Nuevo cliente</>
          )}
        </Button>
      )}

      {/* Create form */}
      {showForm && (
        <div ref={formRef} className="section-card space-y-4">
          <h2 className="text-sm font-semibold">Registrar cliente</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar cliente"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Client list */}
      {clients.length === 0 ? (
        <div className="section-card text-center py-12 space-y-2">
          <UserRound className="w-8 h-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">
            {showArchived ? "No hay clientes archivados" : "No hay clientes registrados"}
          </p>
          {!showArchived && (
            <p className="text-xs text-muted-foreground">Agrega el primero con el botón de arriba</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map((c) => (
            <ClienteCard
              key={c.id}
              client={c}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ClienteCard({
  client,
  onArchive,
  onDelete,
}: {
  client: Cliente
  onArchive: (id: string, archive: boolean) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="section-card p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 shrink-0">
            <UserRound className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{client.name}</p>
            {client.nit && (
              <p className="text-xs text-muted-foreground">{client.nit}</p>
            )}
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="mt-3 pt-3 border-t space-y-3">
          {/* Contact info */}
          <div className="space-y-2">
            {client.phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-3.5 h-3.5 shrink-0" />
                <span>{client.phone}</span>
              </div>
            )}
            {client.address && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{client.address}</span>
              </div>
            )}
            {client.nit && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Hash className="w-3.5 h-3.5 shrink-0" />
                <span>{client.nit}</span>
              </div>
            )}
            {!client.phone && !client.address && !client.nit && (
              <p className="text-xs text-muted-foreground italic">Sin información adicional</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {!client.archived && (
              <Link
                href={`/dashboard/clientes/${client.id}/editar`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Editar
              </Link>
            )}
            <button
              type="button"
              onClick={() => onArchive(client.id, !client.archived)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {client.archived ? (
                <><ArchiveRestore className="w-3.5 h-3.5" />Desarchivar</>
              ) : (
                <><Archive className="w-3.5 h-3.5" />Archivar</>
              )}
            </button>
            {client.archived && (
              <button
                type="button"
                onClick={() => onDelete(client.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/30 text-xs font-medium text-destructive hover:bg-destructive/5 transition-colors ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
