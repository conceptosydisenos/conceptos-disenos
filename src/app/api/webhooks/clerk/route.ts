import { headers } from "next/headers"
import { type WebhookEvent } from "@clerk/nextjs/server"
import { Webhook } from "svix"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET
  if (!WEBHOOK_SECRET) {
    return new Response("Webhook secret not configured", { status: 500 })
  }

  const headerPayload = headers()
  const svix_id = headerPayload.get("svix-id")
  const svix_timestamp = headerPayload.get("svix-timestamp")
  const svix_signature = headerPayload.get("svix-signature")

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 })
  }

  const payload = await req.json()
  const body = JSON.stringify(payload)

  const wh = new Webhook(WEBHOOK_SECRET)
  let evt: WebhookEvent

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent
  } catch {
    return new Response("Invalid webhook signature", { status: 400 })
  }

  if (evt.type === "user.created") {
    const { id, email_addresses, first_name, last_name } = evt.data
    const email = email_addresses[0]?.email_address ?? ""
    const name = [first_name, last_name].filter(Boolean).join(" ") || email

    try {
      await db.insert(users).values({
        clerk_user_id: id,
        name,
        email,
        role: "operative", // Default — change in /configuracion
      })
    } catch (err) {
      console.error("Failed to create user in DB:", err)
      return new Response("DB insert failed", { status: 500 })
    }
  }

  if (evt.type === "user.updated") {
    const { id, email_addresses, first_name, last_name } = evt.data
    const email = email_addresses[0]?.email_address ?? ""
    const name = [first_name, last_name].filter(Boolean).join(" ") || email

    await db
      .update(users)
      .set({ name, email })
      .where(eq(users.clerk_user_id, id))
  }

  if (evt.type === "user.deleted") {
    const { id } = evt.data
    if (id) {
      await db.delete(users).where(eq(users.clerk_user_id, id))
    }
  }

  return new Response("OK", { status: 200 })
}
