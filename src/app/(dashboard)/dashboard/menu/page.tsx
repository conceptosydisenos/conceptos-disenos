import { requireAuth } from "@/lib/auth"
import Link from "next/link"
import { HardHat, Users, BarChart3, TrendingUp, ChevronRight } from "lucide-react"

export default async function MobileMenuPage() {
  const { role } = await requireAuth()

  const menuItems = [
    {
      href: "/dashboard/contratistas",
      icon: HardHat,
      label: "Contratistas",
      description: "Pagos y saldos por contratista",
    },
    ...(role === "admin" || role === "accountant"
      ? [
          {
            href: "/dashboard/rentabilidad",
            icon: TrendingUp,
            label: "Rentabilidad",
            description: "Semáforo de margen y costos",
          },
        ]
      : []),
    ...(role === "admin"
      ? [
          {
            href: "/dashboard/clientes",
            icon: Users,
            label: "Clientes",
            description: "Gestión de clientes",
          },
          {
            href: "/dashboard/reportes",
            icon: BarChart3,
            label: "Reportes",
            description: "Indicadores financieros",
          },
        ]
      : []),
  ]

  return (
    <main className="max-w-lg mx-auto px-4 py-6 space-y-3">
      <h1 className="text-lg font-bold">Menú</h1>
      {menuItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex items-center gap-4 p-4 rounded-2xl border bg-card hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 shrink-0">
            <item.icon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{item.label}</p>
            <p className="text-xs text-muted-foreground">{item.description}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </Link>
      ))}
    </main>
  )
}
