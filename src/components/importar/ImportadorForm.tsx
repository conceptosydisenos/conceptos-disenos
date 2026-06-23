"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react"

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
  size: number
  rawFile: File
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB per file
const MAX_FILES = 5

const ACCEPTED_EXTENSIONS = [".xlsx", ".xls"]

function isExcelFile(filename: string): boolean {
  return ACCEPTED_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(ext))
}

export function ImportadorForm() {
  const [files, setFiles] = useState<SelectedFile[]>([])
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    setError(null)

    if (selected.length + files.length > MAX_FILES) {
      setError(`Máximo ${MAX_FILES} archivos por importación.`)
      return
    }

    const invalid = selected.filter((f) => !isExcelFile(f.name))
    if (invalid.length > 0) {
      setError("Solo se aceptan archivos Excel (.xlsx o .xls).")
      return
    }

    const oversized = selected.filter((f) => f.size > MAX_FILE_SIZE)
    if (oversized.length > 0) {
      setError("Archivo demasiado grande. Máximo 5MB por archivo.")
      return
    }

    const incoming: SelectedFile[] = selected.map((f) => ({
      name: f.name,
      size: f.size,
      rawFile: f,
    }))

    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name))
      return [...prev, ...incoming.filter((f) => !names.has(f.name))]
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
      const formData = new FormData()
      files.forEach((f) => formData.append("files", f.rawFile))

      const res = await fetch("/api/importar", {
        method: "POST",
        body: formData,
      })

      const json = await res.json() as { success: boolean; data?: ImportSummary; error?: string }
      if (!res.ok || !json.success) {
        setError(json.error ?? "Error al importar. Intenta de nuevo.")
        return
      }

      setSummary(json.data ?? null)
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
      {/* Drop zone */}
      <div
        className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-sm font-medium text-foreground">
          Arrastra tu archivo Excel aquí o haz clic para seleccionar
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Sube tu Excel y el sistema clasificará los datos automáticamente
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Máximo {MAX_FILES} archivos · 5MB por archivo · .xlsx o .xls
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
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
              <FileSpreadsheet className="w-4 h-4 text-primary shrink-0" />
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
                { label: "Clientes", key: "clients" as const },
                { label: "Proyectos", key: "projects" as const },
                { label: "Contratistas", key: "contractors" as const },
                { label: "Facturas", key: "invoices" as const },
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
            <div className="section-card bg-emerald-50 border-emerald-200 space-y-1">
              <p className="text-xs font-semibold text-emerald-800">
                Datos no reconocidos ({summary.unrecognized.length})
              </p>
              <ul className="space-y-0.5">
                {summary.unrecognized.map((item, i) => (
                  <li key={i} className="text-xs text-emerald-700">
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
