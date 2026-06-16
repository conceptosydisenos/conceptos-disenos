"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import type { TooltipProps } from "recharts"

export interface MonthCostData {
  month: string
  label: string
  facturas: number
  contratistas: number
  total: number
}

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  notation: "compact",
  compactDisplay: "short",
})

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: p.color }}
          />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{COP.format(Number(p.value))}</span>
        </div>
      ))}
    </div>
  )
}

export function CostEvolutionChart({ data }: { data: MonthCostData[] }) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        Sin datos de costos
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart
        data={data}
        margin={{ top: 4, right: 8, left: -16, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(v) => COP.format(v)}
          tick={{ fontSize: 10, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
        />
        <Line
          type="monotone"
          dataKey="facturas"
          name="Materiales"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 3, fill: "#3b82f6" }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="contratistas"
          name="Contratistas"
          stroke="#8b5cf6"
          strokeWidth={2}
          dot={{ r: 3, fill: "#8b5cf6" }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="total"
          name="Total"
          stroke="#1e3a5f"
          strokeWidth={2.5}
          strokeDasharray="5 3"
          dot={{ r: 3, fill: "#1e3a5f" }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
