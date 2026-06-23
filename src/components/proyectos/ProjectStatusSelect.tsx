"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const OPTIONS = [
  { value: "active", label: "Activo" },
  { value: "paused", label: "En pausa" },
  { value: "completed", label: "Terminado" },
  { value: "in_warranty", label: "En garantía" },
  { value: "cancelled", label: "Cancelado" },
]

const COLOR_MAP: Record<string, string> = {
  active: "text-green-700",
  paused: "text-emerald-700",
  completed: "text-blue-700",
  in_warranty: "text-purple-700",
  cancelled: "text-red-700",
}

interface Props {
  projectId: string
  currentStatus: string
}

export function ProjectStatusSelect({ projectId, currentStatus }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState(currentStatus)
  const [loading, setLoading] = useState(false)

  const handleChange = async (value: string) => {
    setStatus(value)
    setLoading(true)
    try {
      await fetch(`/api/proyectos/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: value }),
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={loading}>
      <SelectTrigger className={`w-36 h-7 text-xs border ${COLOR_MAP[status] ?? ""}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
