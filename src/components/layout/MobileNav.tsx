"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, FolderOpen, Camera, Scissors, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Inicio", exact: true },
  { href: "/dashboard/proyectos", icon: FolderOpen, label: "Proyectos" },
  { href: "/dashboard/facturas/nueva", icon: Camera, label: "Factura", primary: true },
  { href: "/dashboard/cortes", icon: Scissors, label: "Cortes" },
  { href: "/dashboard/menu", icon: MoreHorizontal, label: "Más" },
]

export function MobileNav() {
  const pathname = usePathname()

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href.split("/").slice(0, 3).join("/") + "/")

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-border pb-safe">
      <div className="flex items-end h-16 px-1">
        {tabs.map(({ href, icon: Icon, label, primary, exact }) => {
          const active = isActive(href, exact)
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-end gap-1 flex-1 pb-2 pt-1"
            >
              {primary ? (
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-500 shadow-lg -mt-5">
                  <Icon className="w-5 h-5 text-white" />
                </div>
              ) : (
                <Icon
                  className={cn(
                    "w-5 h-5 transition-colors",
                    active ? "text-[hsl(var(--primary))]" : "text-muted-foreground"
                  )}
                />
              )}
              <span
                className={cn(
                  "text-[10px] font-medium leading-none",
                  primary
                    ? "text-amber-500"
                    : active
                    ? "text-[hsl(var(--primary))]"
                    : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
