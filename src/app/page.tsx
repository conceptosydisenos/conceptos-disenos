import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"

export const dynamic = "force-dynamic"

export default async function RootPage() {
  const { userId } = await auth()
  redirect(userId ? "/dashboard" : "/sign-in")
}
