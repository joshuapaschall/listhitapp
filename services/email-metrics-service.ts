import { getGmailMetrics } from "./gmail-metrics-service"
import { supabaseAdmin } from "@/lib/supabase"
import { assertServer } from "@/utils/assert-server"

assertServer()

const supabase = supabaseAdmin

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0)
}

export async function getEmailCampaignCostMetrics(orgId: string, campaignId?: string | null) {
  let query = supabase
    .from("campaign_recipients")
    .select("actual_cost_usd")
    .eq("org_id", orgId)

  if (campaignId) {
    query = query.eq("campaign_id", campaignId)
  }

  const { data, error } = await query
  if (error) throw error

  const totalCostUsd = (data || []).reduce(
    (sum, recipient) => sum + toNumber(recipient.actual_cost_usd),
    0,
  )

  return { totalCostUsd }
}

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
