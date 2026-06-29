"use client"

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
    >
      Imprimir / Guardar PDF
    </button>
  )
}
