import { UserButton } from "@clerk/nextjs"
import { Bell } from "lucide-react"

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="h-14 border-b border-border bg-background sticky top-0 z-40 flex items-center px-4 md:px-6 gap-4 shrink-0">
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold text-foreground truncate">{title}</h1>
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Bell className="w-4 h-4" />
        </button>
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </header>
  )
}
