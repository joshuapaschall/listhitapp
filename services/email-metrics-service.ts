import { getGmailMetrics } from "./gmail-metrics-service"
import { supabaseAdmin } from "@/lib/supabase"
import { assertServer } from "@/utils/assert-server"

assertServer()

const supabase = supabaseAdmin

export async function updateEmailMetrics(userId: string) {
  const unsubscribed = await updateUnsubscribed()
  let bounces = 0
  // Gmail bounce metrics temporarily disabled — will be re-enabled in Phase 3
  try {
    bounces = await getGmailMetrics(userId)
  } catch (err: any) {
    console.warn("Skipping Gmail metrics (token error)", err.message)
  }
  const opens = await updateOpens()
  return { unsubscribed, bounces, opens }
}

async function updateUnsubscribed() {
  return 0
}

async function updateOpens() {
  const { data: recs } = await supabase
    .from("campaign_recipients")
    .select("id")
    .is("opened_at", null)
    .not("provider_id", "is", null)
  if (!recs) return 0

  return 0
}
