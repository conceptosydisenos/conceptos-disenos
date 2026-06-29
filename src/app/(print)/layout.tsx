import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")
  return <>{children}</>
}
