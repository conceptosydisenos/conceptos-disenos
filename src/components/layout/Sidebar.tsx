"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  LayoutDashboard,
  FolderOpen,
  Receipt,
  Scissors,
  HardHat,
  Users,
  BarChart3,
  LogOut,
  TrendingUp,
  FileUp,
  UserRoundSearch,
  FileText,
  Activity,
  BellRing,
  MessageSquare,
} from "lucide-react"
import { useClerk, useUser } from "@clerk/nextjs"
import { cn } from "@/lib/utils"
import type { SystemAlert } from "@/lib/alertas"

const navItems = [
  { href: "/dashboard",              icon: LayoutDashboard, label: "Resumen",       exact: true },
  { href: "/dashboard/leads",        icon: UserRoundSearch, label: "Leads" },
  { href: "/dashboard/cotizaciones", icon: FileText,        label: "Cotizaciones" },
  { href: "/dashboard/proyectos",    icon: FolderOpen,      label: "Proyectos" },
  { href: "/dashboard/facturas",     icon: Receipt,         label: "Facturas" },
  { href: "/dashboard/cortes",       icon: Scissors,        label: "Cortes de obra" },
  { href: "/dashboard/contratistas", icon: HardHat,         label: "Contratistas" },
]

const adminItems = [
  { href: "/dashboard/alertas",      icon: BellRing,      label: "Alertas",        badge: true },
  { href: "/dashboard/asistente",    icon: MessageSquare, label: "Asistente" },
  { href: "/dashboard/rentabilidad", icon: TrendingUp,    label: "Rentabilidad" },
  { href: "/dashboard/clientes",     icon: Users,         label: "Clientes" },
  { href: "/dashboard/reportes",     icon: BarChart3,     label: "Reportes" },
  { href: "/dashboard/importar",     icon: FileUp,        label: "Importar datos" },
]

interface SidebarProps {
  role: string
  userName: string
}

export function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname()
  const { signOut } = useClerk()
  const { user: clerkUser } = useUser()
  const [criticalBadge, setCriticalBadge] = useState(0)

  useEffect(() => {
    if (role !== "admin") return
    fetch("/api/alertas")
      .then(r => r.json())
      .then((d: { success: boolean; data?: SystemAlert[] }) => {
        if (d.success && Array.isArray(d.data)) {
          setCriticalBadge(
            d.data.filter(a => a.severity === "critica" || a.severity === "alta").length
          )
        }
      })
      .catch(() => {})
  }, [role])

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/")

  const initials = userName
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  const roleLabel =
    role === "admin" ? "Administrador" : role === "operative" ? "Campo" : "Contabilidad"

  return (
    <aside className="hidden md:flex flex-col w-[240px] min-h-[100dvh] bg-white border-r border-gray-200 shrink-0">

      {/* Brand */}
      <div className="flex items-center gap-3 px-5 h-14 border-b border-gray-100">
        <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 shrink-0 overflow-hidden flex items-center justify-center">
          <Image
            src="/logo.jpg"
            alt="Conceptos y Diseños"
            width={36}
            height={36}
            className="object-contain"
          />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 leading-tight truncate">
            Conceptos y Diseños
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label, exact }) => {
          const active = isActive(href, exact)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-[#F0FDF9] text-[#2D9B6F]"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 shrink-0",
                  active ? "text-[#2D9B6F]" : "text-gray-400"
                )}
              />
              {label}
            </Link>
          )
        })}

        {role === "admin" && (
          <>
            <div className="pt-5 pb-2 px-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                Comercial
              </p>
            </div>
            <Link
              href="/dashboard/seguimiento"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive("/dashboard/seguimiento")
                  ? "bg-[#F0FDF9] text-[#2D9B6F]"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              <Activity
                className={cn(
                  "w-4 h-4 shrink-0",
                  isActive("/dashboard/seguimiento") ? "text-[#2D9B6F]" : "text-gray-400"
                )}
              />
              Seguimiento
            </Link>

            <div className="pt-5 pb-2 px-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                Administración
              </p>
            </div>
            {adminItems.map(({ href, icon: Icon, label, ...rest }) => {
              const active = isActive(href)
              const showBadge = "badge" in rest && rest.badge && criticalBadge > 0
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    active
                      ? "bg-[#F0FDF9] text-[#2D9B6F]"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 shrink-0",
                      active ? "text-[#2D9B6F]" : "text-gray-400"
                    )}
                  />
                  <span className="flex-1">{label}</span>
                  {showBadge && (
                    <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white shrink-0">
                      {criticalBadge > 9 ? "9+" : criticalBadge}
                    </span>
                  )}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* User profile */}
      <div className="px-3 py-3 border-t border-gray-100">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          {clerkUser?.imageUrl ? (
            <Image
              src={clerkUser.imageUrl}
              alt={userName}
              width={32}
              height={32}
              className="rounded-full object-cover ring-1 ring-gray-200 shrink-0"
            />
          ) : (
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-xs font-bold text-gray-600 shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-700 truncate">{userName}</p>
            <p className="text-xs text-gray-400">{roleLabel}</p>
          </div>
          <button
            onClick={() => signOut({ redirectUrl: "/sign-in" })}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
