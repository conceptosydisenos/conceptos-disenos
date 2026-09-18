"use client"

import type { ReactNode } from "react"
import { useDroppable } from "@dnd-kit/core"

interface DroppableColumnProps {
  id: string
  className?: string
  children: ReactNode
}

export function DroppableColumn({ id, className = "", children }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver ? "bg-primary/5 ring-2 ring-primary/40 ring-inset" : ""}`}
    >
      {children}
    </div>
  )
}
