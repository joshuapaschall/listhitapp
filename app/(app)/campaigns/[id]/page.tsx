import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import CampaignReport from "@/components/campaigns/CampaignReport"
import MainLayout from "@/components/layout/main-layout"
import { resolveOrgIdForUser } from "@/lib/auth/org-context"

export const dynamic = "force-dynamic"

export default async function CampaignReportPage({ params }: { params: { id: string } }) {
  const supabase = createServerComponentClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const orgId = await resolveOrgIdForUser(user.id)
  if (!orgId) notFound()

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id,name,channel,subject,message,status,scheduled_at,created_at,user_id,media_url")
    .eq("id", params.id)
    .eq("org_id", orgId)
    .maybeSingle()

  if (!campaign) notFound()
  if (campaign.status === "draft") redirect(`/campaigns/${params.id}/edit`)

  return <MainLayout><CampaignReport campaign={campaign as any} /></MainLayout>
}
