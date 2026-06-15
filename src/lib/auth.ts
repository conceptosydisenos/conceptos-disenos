import { auth } from "@clerk/nextjs/server"
import { db } from "./db"
import { users } from "./db/schema"
import { eq } from "drizzle-orm"

export type UserRole = "admin" | "operative" | "accountant"

export async function getCurrentUser() {
  const { userId } = await auth()
  if (!userId) return null
  return db.query.users.findFirst({
    where: eq(users.clerk_user_id, userId),
  })
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error("Unauthorized: not authenticated")
  }
  return user
}

export async function requireRole(allowedRoles: UserRole[]) {
  const user = await getCurrentUser()
  if (!user || !allowedRoles.includes(user.role as UserRole)) {
    throw new Error("Forbidden: insufficient permissions")
  }
  return user
}

export function isAdmin(role: string): boolean {
  return role === "admin"
}

export function canEdit(role: string): boolean {
  return role === "admin" || role === "operative"
}
