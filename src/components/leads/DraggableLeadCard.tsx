"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { LeadCard, type LeadRow } from "./LeadCard"

interface DraggableLeadCardProps {
  lead: LeadRow
}

export function DraggableLeadCard({ lead }: DraggableLeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { status: lead.status },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`touch-none ${isDragging ? "opacity-40" : ""}`}
    >
      <LeadCard lead={lead} />
    </div>
  )
}
