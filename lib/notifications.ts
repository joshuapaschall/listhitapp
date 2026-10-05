import { supabaseAdmin } from "@/lib/supabase/admin"
import { assertServer } from "@/utils/assert-server"

assertServer()

export async function insertNotification(params: {
  type: string
  title: string
  // Required. notifications.org_id loses its GWH column default in Phase 1B, so
  // a service-role insert that omits it now fails NOT NULL instead of quietly
  // showing one tenant's notification to another.
  orgId: string
  body?: string
  metadata?: Record<string, any>
}) {
  const { error } = await supabaseAdmin.from("notifications").insert({
    type: params.type,
    title: params.title,
    org_id: params.orgId,
    body: params.body || null,
    metadata: params.metadata || {},
  })

  if (error) console.error("Failed to insert notification:", error)
}
