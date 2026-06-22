"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

const ACTIVITY_TYPES = [
  { value: "llamada",  label: "Llamada",   emoji: "📞" },
  { value: "whatsapp", label: "WhatsApp",  emoji: "💬" },
  { value: "visita",   label: "Visita",    emoji: "🏠" },
  { value: "email",    label: "Email",     emoji: "📧" },
  { value: "nota",     label: "Nota",      emoji: "📝" },
]

interface Props {
  leadId: string
  onSuccess?: () => void
}

export function AddActivityForm({ leadId, onSuccess }: Props) {
  const router = useRouter()
  const [type, setType] = useState("llamada")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const data = new FormData(e.currentTarget)

    try {
      const res = await fetch(`/api/leads/${leadId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity_type: type,
          summary: data.get("summary"),
          outcome: data.get("outcome") || undefined,
        }),
      })
      const json = await res.json() as { success: boolean; error?: string }

      if (!json.success) {
        setError(json.error ?? "Error al guardar")
        setSaving(false)
        return
      }

      ;(e.target as HTMLFormElement).reset()
      router.refresh()
      onSuccess?.()
    } catch {
      setError("Error de conexión")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {ACTIVITY_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0
              ${type === t.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
          >
            <span>{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div>
        <Label htmlFor="summary">Resumen *</Label>
        <Textarea
          id="summary"
          name="summary"
          required
          rows={2}
          placeholder="¿Qué pasó?"
          className="mt-1.5 resize-none"
        />
      </div>

      <div>
        <Label htmlFor="outcome">
          Resultado <span className="text-muted-foreground font-normal">(opcional)</span>
        </Label>
        <Textarea
          id="outcome"
          name="outcome"
          rows={2}
          placeholder="¿Qué se acordó? ¿Próximo paso?"
          className="mt-1.5 resize-none"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? "Guardando..." : "Registrar actividad"}
      </Button>
    </form>
  )
}
