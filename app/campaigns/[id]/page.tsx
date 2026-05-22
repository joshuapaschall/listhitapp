import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import CampaignReport from "@/components/campaigns/CampaignReport"
import MainLayout from "@/components/layout/main-layout"

export const dynamic = "force-dynamic"

export default async function CampaignReportPage({ params }: { params: { id: string } }) {
  const supabase = createServerComponentClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id,name,channel,subject,message,status,scheduled_at,created_at,user_id,media_url")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!campaign) notFound()
  if (campaign.status === "draft") redirect(`/campaigns/${params.id}/edit`)

  return <MainLayout><CampaignReport campaign={campaign as any} /></MainLayout>
}
