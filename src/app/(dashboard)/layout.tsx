import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { MobileNav } from "@/components/layout/MobileNav"
import { getCurrentUser } from "@/lib/auth"
import { Toaster } from "@/components/ui/toaster"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/sign-in")
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={user.role} userName={user.name} />
      <div className="flex flex-col flex-1 min-w-0">
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </div>
      <MobileNav />
      <Toaster />
    </div>
  )
}
