"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Upload, FileText, X, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react"

interface ImportSummary {
  clients: { created: number; skipped: number }
  projects: { created: number; skipped: number }
  contractors: { created: number; skipped: number }
  invoices: { created: number; skipped: number }
  unrecognized: string[]
  errors: string[]
}

interface SelectedFile {
  name: string
  content: string
  size: number
}

const MAX_FILE_SIZE = 500 * 1024 // 500KB per file
const MAX_FILES = 10

export function ImportadorForm() {
  const [files, setFiles] = useState<SelectedFile[]>([])
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    setError(null)

    if (selected.length + files.length > MAX_FILES) {
      setError(`Máximo ${MAX_FILES} archivos por importación.`)
      return
    }

    const invalid = selected.filter((f) => !f.name.endsWith(".md"))
    if (invalid.length > 0) {
      setError("Solo se aceptan archivos .md (Markdown). Convierte tus Excel con MarkItDown primero.")
      return
    }

    const oversized = selected.filter((f) => f.size > MAX_FILE_SIZE)
    if (oversized.length > 0) {
      setError(`Archivo demasiado grande. Máximo 500KB por archivo. Divide el Excel en hojas más pequeñas.`)
      return
    }

    const loaded: SelectedFile[] = await Promise.all(
      selected.map(
        (f) =>
          new Promise<SelectedFile>((resolve) => {
            const reader = new FileReader()
            reader.onload = (ev) =>
              resolve({ name: f.name, content: String(ev.target?.result ?? ""), size: f.size })
            reader.readAsText(f, "utf-8")
          })
      )
    )

    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name))
      return [...prev, ...loaded.filter((f) => !names.has(f.name))]
    })

    if (inputRef.current) inputRef.current.value = ""
  }

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name))
    setSummary(null)
  }

  const handleImport = async () => {
    if (files.length === 0) return
    setLoading(true)
    setError(null)
    setSummary(null)

    try {
      const res = await fetch("/api/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: files.map((f) => ({ name: f.name, content: f.content })) }),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(json.error ?? "Error al importar. Intenta de nuevo.")
        return
      }

      setSummary(json.data)
      setFiles([])
    } catch {
      setError("Error de conexión. Verifica tu internet e intenta de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  const totalImported = summary
    ? summary.clients.created + summary.projects.created + summary.contractors.created + summary.invoices.created
    : 0

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="section-card bg-blue-50 border-blue-200 space-y-2">
        <p className="text-sm font-semibold text-blue-800">Cómo preparar tus archivos</p>
        <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
          <li>Abre tu Excel y selecciona las hojas que quieres importar</li>
          <li>
            Convierte a Markdown con MarkItDown:{" "}
            <code className="bg-blue-100 px-1 rounded font-mono">markitdown archivo.xlsx &gt; archivo.md</code>
          </li>
          <li>Sube el archivo .md aquí — la IA clasifica y distribuye los datos automáticamente</li>
        </ol>
      </div>

      {/* Drop zone */}
      <div
        className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-sm font-medium text-foreground">
          Arrastra tus archivos .md aquí o haz clic para seleccionar
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Máximo {MAX_FILES} archivos · 500KB por archivo · Solo .md
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".md,text/markdown"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {files.length} archivo{files.length !== 1 ? "s" : ""} listo{files.length !== 1 ? "s" : ""}
          </p>
          {files.map((f) => (
            <div
              key={f.name}
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/50 border border-border"
            >
              <FileText className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(f.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                onClick={() => removeFile(f.name)}
                className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                disabled={loading}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          <Button
            onClick={handleImport}
            disabled={loading}
            className="w-full mt-2 gap-2"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analizando con IA...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Importar {files.length} archivo{files.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Results */}
      {summary && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <p className="text-sm font-semibold text-green-800">
              Importación completada — {totalImported} registros nuevos
            </p>
          </div>

          {/* Summary grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(
              [
                { label: "Clientes", key: "clients" as const, href: "/dashboard/proyectos" },
                { label: "Proyectos", key: "projects" as const, href: "/dashboard/proyectos" },
                { label: "Contratistas", key: "contractors" as const, href: "/dashboard/contratistas" },
                { label: "Facturas", key: "invoices" as const, href: "/dashboard/facturas" },
              ] as const
            ).map(({ label, key }) => (
              <div key={key} className="section-card p-4 text-center">
                <p className="text-2xl font-bold text-foreground tabular-nums">
                  {summary[key].created}
                </p>
                <p className="text-xs font-medium text-foreground mt-0.5">{label}</p>
                {summary[key].skipped > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {summary[key].skipped} ya existían
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Unrecognized */}
          {summary.unrecognized.length > 0 && (
            <div className="section-card bg-amber-50 border-amber-200 space-y-1">
              <p className="text-xs font-semibold text-amber-800">
                Datos no reconocidos ({summary.unrecognized.length})
              </p>
              <ul className="space-y-0.5">
                {summary.unrecognized.map((item, i) => (
                  <li key={i} className="text-xs text-amber-700">
                    · {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Errors */}
          {summary.errors.length > 0 && (
            <div className="section-card bg-red-50 border-red-200 space-y-1">
              <p className="text-xs font-semibold text-red-800">
                Errores al guardar ({summary.errors.length})
              </p>
              <ul className="space-y-0.5">
                {summary.errors.map((err, i) => (
                  <li key={i} className="text-xs text-red-700">
                    · {err}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Facturas notice */}
          {summary.invoices.created > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
              <AlertTriangle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                Las {summary.invoices.created} facturas importadas quedaron en estado{" "}
                <strong>pendiente de asignación</strong>. Asígnalas a sus proyectos en{" "}
                <a href="/dashboard/facturas" className="underline font-medium">
                  Facturas
                </a>
                .
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
