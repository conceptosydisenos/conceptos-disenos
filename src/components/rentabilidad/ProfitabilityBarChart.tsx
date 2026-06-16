"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts"
import type { TooltipProps } from "recharts"

const STATUS_COLORS = {
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
} as const

export interface ProjectBarData {
  name: string
  shortName: string
  marginPct: number
  marginStatus: "green" | "amber" | "red"
}

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as ProjectBarData
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold mb-0.5">{d.name}</p>
      <p style={{ color: STATUS_COLORS[d.marginStatus] }} className="font-bold text-sm">
        {d.marginPct.toFixed(1)}% margen
      </p>
    </div>
  )
}

export function ProfitabilityBarChart({ data }: { data: ProjectBarData[] }) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        Sin proyectos activos
      </div>
    )
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <div style={{ minWidth: Math.max(data.length * 72, 280) }}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={data}
            margin={{ top: 4, right: 8, left: -16, bottom: 24 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="shortName"
              tick={{ fontSize: 10, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
              domain={["auto", "auto"]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f1f5f9" }} />
            <ReferenceLine y={15} stroke="#22c55e" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: "15%", position: "right", fontSize: 9, fill: "#22c55e" }} />
            <ReferenceLine y={5} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: "5%", position: "right", fontSize: 9, fill: "#f59e0b" }} />
            <Bar dataKey="marginPct" radius={[4, 4, 0, 0]} maxBarSize={52}>
              {data.map((entry, i) => (
                <Cell key={i} fill={STATUS_COLORS[entry.marginStatus]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
