"use client"

import { useEffect, useState } from "react"
import { Printer } from "lucide-react"

export function PrintButton() {
  const [label, setLabel] = useState("Imprimir / Guardar PDF")

  useEffect(() => {
    if (window.innerWidth < 768 || navigator.maxTouchPoints > 0) {
      setLabel("Guardar como PDF")
    }
  }, [])

  return (
    <button
      onClick={() => window.print()}
      className="print:hidden fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 bg-[#1C2333] text-white text-sm font-semibold rounded-xl shadow-xl hover:bg-[#2a3347] active:scale-95 transition-all"
    >
      <Printer className="w-4 h-4" />
      {label}
    </button>
  )
}
