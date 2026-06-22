"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const SOURCES = [
  { value: "referido",        label: "Referido" },
  { value: "voz_a_voz",       label: "Voz a voz" },
  { value: "volante",         label: "Volante" },
  { value: "aliado",          label: "Aliado" },
  { value: "web",             label: "Web" },
  { value: "redes",           label: "Redes sociales" },
  { value: "whatsapp",        label: "WhatsApp" },
  { value: "llamada_directa", label: "Llamada directa" },
  { value: "otro",            label: "Otro" },
]

export function LeadForm() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const data = new FormData(e.currentTarget)

    const body = {
      contact_name:        data.get("contact_name"),
      contact_phone:       data.get("contact_phone"),
      contact_email:       data.get("contact_email") || undefined,
      project_description: data.get("project_description"),
      project_address:     data.get("project_address") || undefined,
      estimated_value:     data.get("estimated_value") ? Number(data.get("estimated_value")) : undefined,
      source:              data.get("source"),
      notes:               data.get("notes") || undefined,
    }

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json() as { success: boolean; error?: string; data?: { id: string } }

      if (!json.success) {
        setError(json.error ?? "Error al guardar")
        setSaving(false)
        return
      }

      router.push(`/dashboard/leads/${json.data!.id}`)
      router.refresh()
    } catch {
      setError("Error de conexión")
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Contacto */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contacto</p>
        <div>
          <Label htmlFor="contact_name">Nombre del contacto *</Label>
          <Input
            id="contact_name"
            name="contact_name"
            placeholder="Ej. Juan García"
            required
            className="mt-1.5"
            autoComplete="off"
          />
        </div>
        <div>
          <Label htmlFor="contact_phone">Teléfono / WhatsApp *</Label>
          <Input
            id="contact_phone"
            name="contact_phone"
            type="tel"
            placeholder="Ej. 300 123 4567"
            required
            className="mt-1.5"
            inputMode="tel"
          />
        </div>
        <div>
          <Label htmlFor="contact_email">
            Email <span className="text-muted-foreground font-normal">(opcional)</span>
          </Label>
          <Input
            id="contact_email"
            name="contact_email"
            type="email"
            placeholder="correo@ejemplo.com"
            className="mt-1.5"
            autoComplete="off"
          />
        </div>
      </div>

      {/* Proyecto */}
      <div className="space-y-4 pt-2 border-t border-border">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Proyecto</p>
        <div>
          <Label htmlFor="project_description">Descripción del proyecto *</Label>
          <Textarea
            id="project_description"
            name="project_description"
            placeholder="Ej. Remodelación cocina y dos baños, cambio de pisos en sala y comedor"
            required
            rows={3}
            className="mt-1.5 resize-none"
          />
        </div>
        <div>
          <Label htmlFor="project_address">
            Dirección de la obra <span className="text-muted-foreground font-normal">(opcional)</span>
          </Label>
          <Input
            id="project_address"
            name="project_address"
            placeholder="Ej. Cll 100 #15-30, Bogotá"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="estimated_value">
            Valor estimado (COP) <span className="text-muted-foreground font-normal">(opcional)</span>
          </Label>
          <Input
            id="estimated_value"
            name="estimated_value"
            type="number"
            step={1}
            min={0}
            placeholder="Ej. 15000000"
            className="mt-1.5"
            inputMode="numeric"
          />
        </div>
      </div>

      {/* Fuente */}
      <div className="space-y-3 pt-2 border-t border-border">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">¿Cómo llegó?</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SOURCES.map((s, i) => (
            <label
              key={s.value}
              className="relative flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border cursor-pointer
                hover:border-primary/40 hover:bg-primary/5 transition-colors
                has-[input:checked]:border-primary has-[input:checked]:bg-primary/8"
            >
              <input
                type="radio"
                name="source"
                value={s.value}
                defaultChecked={i === 0}
                className="sr-only"
                required
              />
              <span className="text-xs font-medium">{s.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Notas */}
      <div className="pt-2 border-t border-border">
        <Label htmlFor="notes">
          Notas <span className="text-muted-foreground font-normal">(opcional)</span>
        </Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="Contexto adicional, urgencia, preferencias del cliente..."
          rows={3}
          className="mt-1.5 resize-none"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving} className="flex-1">
          {saving ? "Guardando..." : "Crear lead"}
        </Button>
      </div>
    </form>
  )
}
