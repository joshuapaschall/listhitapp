import { randomUUID } from "crypto"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { resolveOrgIdForUser } from "@/lib/auth/org-context"

export const dynamic = "force-dynamic"

export default async function NewCampaignPage({ searchParams }: { searchParams: { prefill?: string; duplicateOf?: string; type?: string } }) {
  const cookieStore = cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const orgId = await resolveOrgIdForUser(user.id)
  if (!orgId) redirect("/login")

  const channel = searchParams?.type === "sms" ? "sms" : "email"
  const prefill = searchParams?.prefill
  let campaignId = ""

  if (searchParams?.duplicateOf) {
    const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", searchParams.duplicateOf).eq("org_id", orgId).maybeSingle()
    if (!campaign) redirect("/campaigns")
    const payload = { id: randomUUID(), user_id: user.id, org_id: orgId, name: `${campaign.name || "Untitled campaign"} (copy)`, subject: campaign.subject, message: campaign.message, group_ids: campaign.group_ids || [], buyer_ids: campaign.buyer_ids || [], channel: campaign.channel, media_url: campaign.media_url, scheduled_at: null, send_to_all_numbers: campaign.send_to_all_numbers, run_from: campaign.run_from, run_until: campaign.run_until, weekday_only: campaign.weekday_only, timezone: campaign.timezone, from_name: campaign.from_name, from_email: campaign.from_email, status: "draft", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    const { data: inserted } = await supabase.from("campaigns").insert(payload).select("id").single()
    campaignId = inserted?.id
  } else {
    const { data: inserted } = await supabase.from("campaigns").insert({ id: randomUUID(), user_id: user.id, org_id: orgId, name: "Untitled campaign", subject: null, message: null, channel, group_ids: [], buyer_ids: [], scheduled_at: null, status: "draft", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }).select("id").single()
    campaignId = inserted?.id
  }

  if (!campaignId) redirect("/campaigns")
  const editPath = `/campaigns/${campaignId}/edit`
  const suffix = prefill ? `?prefill=${prefill}` : ""
  redirect(`${editPath}${suffix}`)
}
