"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
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
} from "lucide-react"
import { useClerk, useUser } from "@clerk/nextjs"
import { cn } from "@/lib/utils"

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
  { href: "/dashboard/rentabilidad", icon: TrendingUp, label: "Rentabilidad" },
  { href: "/dashboard/clientes",     icon: Users,      label: "Clientes" },
  { href: "/dashboard/reportes",     icon: BarChart3,  label: "Reportes" },
  { href: "/dashboard/importar",     icon: FileUp,     label: "Importar datos" },
]

interface SidebarProps {
  role: string
  userName: string
}

export function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname()
  const { signOut } = useClerk()
  const { user: clerkUser } = useUser()

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
    <aside className="hidden md:flex flex-col w-[240px] min-h-screen bg-[hsl(var(--sidebar-bg))] shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 h-14 border-b border-white/10">
        <div className="w-9 h-9 rounded-lg bg-white shrink-0 overflow-hidden flex items-center justify-center">
          <Image
            src="/logo.jpg"
            alt="Conceptos y Diseños"
            width={36}
            height={36}
            className="object-contain"
          />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white leading-tight truncate">
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
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/8"
              )}
            >
              <Icon
                className={cn("w-4 h-4 shrink-0", active ? "text-amber-400" : "text-white/40")}
              />
              {label}
            </Link>
          )
        })}

        {role === "admin" && (
          <>
            <div className="pt-5 pb-2 px-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
                Comercial
              </p>
            </div>
            <Link
              href="/dashboard/seguimiento"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive("/dashboard/seguimiento")
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/8"
              )}
            >
              <Activity
                className={cn(
                  "w-4 h-4 shrink-0",
                  isActive("/dashboard/seguimiento") ? "text-amber-400" : "text-white/40"
                )}
              />
              Seguimiento
            </Link>

            <div className="pt-5 pb-2 px-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
                Administración
              </p>
            </div>
            {adminItems.map(({ href, icon: Icon, label }) => {
              const active = isActive(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    active
                      ? "bg-white/15 text-white"
                      : "text-white/60 hover:text-white hover:bg-white/8"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 shrink-0",
                      active ? "text-amber-400" : "text-white/40"
                    )}
                  />
                  {label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* User profile */}
      <div className="px-3 py-3 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          {clerkUser?.imageUrl ? (
            <Image
              src={clerkUser.imageUrl}
              alt={userName}
              width={32}
              height={32}
              className="rounded-full object-cover ring-1 ring-white/30 shrink-0"
            />
          ) : (
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/15 ring-1 ring-white/30 text-xs font-bold text-white shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{userName}</p>
            <p className="text-xs text-white/45">{roleLabel}</p>
          </div>
          <button
            onClick={() => signOut({ redirectUrl: "/sign-in" })}
            className="p-1 text-white/40 hover:text-white/80 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
