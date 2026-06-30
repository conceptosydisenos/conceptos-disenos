import { headers } from "next/headers"
import { type WebhookEvent } from "@clerk/nextjs/server"
import { Webhook } from "svix"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET
  if (!WEBHOOK_SECRET) {
    console.error("[webhook/clerk] CLERK_WEBHOOK_SECRET not set")
    return new Response("Webhook secret not configured", { status: 500 })
  }

  const headerPayload = headers()
  const svix_id        = headerPayload.get("svix-id")
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
      "svix-id":        svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent
  } catch {
    return new Response("Invalid webhook signature", { status: 400 })
  }

  // ── user.created ──────────────────────────────────────────────
  if (evt.type === "user.created") {
    const { id, email_addresses, first_name, last_name } = evt.data
    const email = email_addresses[0]?.email_address ?? ""
    const name  = [first_name, last_name].filter(Boolean).join(" ") || email

    try {
      await db
        .insert(users)
        .values({
          clerk_user_id: id,
          name,
          email,
          role: "operative",
        })
        .onConflictDoNothing()
    } catch (err) {
      console.error("[webhook/clerk] user.created DB error:", err)
      return new Response("DB insert failed", { status: 500 })
    }
  }

  // ── user.updated ──────────────────────────────────────────────
  if (evt.type === "user.updated") {
    const { id, email_addresses, first_name, last_name } = evt.data
    const email = email_addresses[0]?.email_address ?? ""
    const name  = [first_name, last_name].filter(Boolean).join(" ") || email

    try {
      await db
        .update(users)
        .set({ name, email, updated_at: new Date() })
        .where(eq(users.clerk_user_id, id))
    } catch (err) {
      console.error("[webhook/clerk] user.updated DB error:", err)
    }
  }

  // ── user.deleted ──────────────────────────────────────────────
  if (evt.type === "user.deleted") {
    const { id } = evt.data
    if (!id) return new Response("OK", { status: 200 })

    // Check for FK-referenced rows before deleting.
    // If the user created projects, quotes, invoices etc., keep the record
    // to preserve audit trail — just skip deletion silently.
    try {
      const result = await db.execute(
        sql`SELECT EXISTS (
          SELECT 1 FROM projects WHERE created_by = (SELECT id FROM users WHERE clerk_user_id = ${id}) LIMIT 1
          UNION ALL
          SELECT 1 FROM quotes   WHERE created_by = (SELECT id FROM users WHERE clerk_user_id = ${id}) LIMIT 1
        ) AS has_refs`
      )
      const refs = (result as unknown as { rows: { has_refs: boolean }[] }).rows?.[0]
        ?? (result as unknown as { has_refs: boolean }[])[0]

      if (refs?.has_refs) {
        // User has associated data — keep the record for referential integrity
        console.log(`[webhook/clerk] user.deleted skipped (has refs): ${id}`)
        return new Response("OK", { status: 200 })
      }

      await db.delete(users).where(eq(users.clerk_user_id, id))
    } catch (err) {
      // FK constraint or other error — skip deletion, preserve audit trail
      console.error("[webhook/clerk] user.deleted error (skipping):", err)
    }
  }

  return new Response("OK", { status: 200 })
}
