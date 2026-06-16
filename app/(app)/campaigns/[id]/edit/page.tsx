import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import CampaignComposeView from "@/components/campaigns/campaign-compose-view"
import SmsCampaignComposeView from "@/components/campaigns/sms-campaign-compose-view"
import { resolveOrgIdForUser } from "@/lib/auth/org-context"

export const dynamic = "force-dynamic"

export default async function EditCampaignPage({ params }: { params: { id: string } }) {
  const supabase = createServerComponentClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const orgId = await resolveOrgIdForUser(user.id)
  if (!orgId) notFound()

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", params.id)
    .eq("org_id", orgId)
    .maybeSingle()

  if (!campaign) notFound()
  if (campaign.status === "sent" || campaign.status === "sending") redirect(`/campaigns/${params.id}`)

  if (campaign.channel === "sms") {
    return <SmsCampaignComposeView initialCampaign={campaign} />
  }

  return <CampaignComposeView initialCampaign={campaign} />
}
