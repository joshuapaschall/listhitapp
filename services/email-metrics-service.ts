import { fetchUnsubscribed, getEmail } from "./sendfox-service"
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
  const list = await fetchUnsubscribed()
  const emails = list
    .map((u: any) => (u.email || "").toLowerCase())
    .filter(Boolean)
  if (!emails.length) return 0

  const { data: buyers } = await supabase
    .from("buyers")
    .select("id,email_norm")
    .in("email_norm", emails)
  const ids = (buyers || []).map((b: any) => b.id)
  if (!ids.length) return 0

  await supabase.from("buyers").update({ can_receive_email: false }).in("id", ids)
  await supabase
    .from("campaign_recipients")
    .update({ unsubscribed_at: new Date().toISOString() })
    .in("buyer_id", ids)
    .is("unsubscribed_at", null)
  return ids.length
}

async function updateOpens() {
  const { data: recs } = await supabase
    .from("campaign_recipients")
    .select("id,provider_id")
    .is("opened_at", null)
    .not("provider_id", "is", null)
  if (!recs) return 0
  let count = 0
  for (const r of recs) {
    try {
      const data = await getEmail(r.provider_id as string)
      if (data?.open_rate && Number(data.open_rate) > 0) {
        await supabase
          .from("campaign_recipients")
          .update({ opened_at: new Date().toISOString() })
          .eq("id", r.id)
        count++
      }
    } catch {}
  }
  return count
}
