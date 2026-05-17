import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import CampaignComposeView from "@/components/campaigns/campaign-compose-view"

export const dynamic = "force-dynamic"

export default async function EditCampaignPage({ params }: { params: { id: string } }) {
  const supabase = createServerComponentClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!campaign) notFound()
  if (campaign.status === "sent" || campaign.status === "sending") redirect(`/campaigns/${params.id}`)

  return <CampaignComposeView initialCampaign={campaign} />
}
