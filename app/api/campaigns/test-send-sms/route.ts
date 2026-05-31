import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { calculateSmsSegments } from "@/lib/sms-utils"
import { renderTemplate } from "@/lib/utils"
import { formatPhoneE164 } from "@/lib/dedup-utils"
import { sendCampaignSMS } from "@/services/campaign-sender.server"
import { getUserMergeContext } from "@/lib/user-context"
import { requirePermission } from "@/lib/permissions/server"

function parseMediaUrls(value: unknown): string[] {
  if (!value || typeof value !== "string") return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []
  } catch {
    return typeof value === "string" ? [value] : []
  }
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const denied = await requirePermission(supabase, "campaigns.send_sms")
  if (denied) return denied

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { campaignId, testPhone, forceDryRun } = await request.json()
  if (!campaignId || !testPhone) return NextResponse.json({ error: "campaignId and testPhone required" }, { status: 400 })

  const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", campaignId).eq("user_id", user.id).maybeSingle()
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
  if (campaign.status === "sent" || campaign.status === "sending") return NextResponse.json({ error: "Campaign cannot be edited" }, { status: 403 })
  if (campaign.channel !== "sms") return NextResponse.json({ error: "Campaign must be sms" }, { status: 400 })

  const formattedPhone = formatPhoneE164(testPhone)
  if (!formattedPhone) return NextResponse.json({ error: "Invalid test phone" }, { status: 400 })
  const mediaUrls = parseMediaUrls(campaign.media_url)
  if (!campaign.message?.trim() && mediaUrls.length === 0) return NextResponse.json({ error: "Campaign has no content" }, { status: 400 })
  const seg = calculateSmsSegments(campaign.message || "")
  if (seg.segments > 10) return NextResponse.json({ error: "Message exceeds 10 segments" }, { status: 400 })

  const senderContext = await getUserMergeContext(supabase, user.id)
  const rendered = renderTemplate(
    campaign.message || "",
    { fname: "Test", lname: "User", phone: formattedPhone } as any,
    senderContext,
  )
  const dryRun = forceDryRun ?? (process.env.LISTHIT_DRY_RUN === "1")
  const results = await sendCampaignSMS({ buyerId: undefined, to: [formattedPhone], body: rendered, mediaUrls, dryRun, campaignId: undefined, isTest: true })
  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      formattedTo: formattedPhone,
      fromNumber: results[0]?.from ?? null,
      message: "Dry-run: no Telnyx call made",
      rendered,
      results,
    })
  }
  return NextResponse.json({ ok: true, dryRun, formattedTo: formattedPhone, fromNumber: results[0]?.from ?? null, results })
}
