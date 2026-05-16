import { supabaseAdmin } from "@/lib/supabase/admin"
import { assertServer } from "@/utils/assert-server"

assertServer()

export async function insertNotification(params: {
  type: string
  title: string
  body?: string
  metadata?: Record<string, any>
}) {
  const { error } = await supabaseAdmin.from("notifications").insert({
    type: params.type,
    title: params.title,
    body: params.body || null,
    metadata: params.metadata || {},
  })

  if (error) console.error("Failed to insert notification:", error)
}
