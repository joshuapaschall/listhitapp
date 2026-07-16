import { NextRequest, NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { requirePermission } from "@/lib/permissions/server"
import { supabaseAdmin } from "@/lib/supabase"
import { resolveCampaignSender, SenderNotVerifiedError } from "@/lib/email-sender-resolver"
import { isValidEmailSyntax } from "@/lib/email/validate-syntax"
import { apiError } from "@/lib/api-error"
import { linkifyHtml } from "@/lib/email/linkify-html"
import { stampBusinessAddressForCampaign } from "@/services/campaign-sender"
import { getUserMergeContext, splitName } from "@/lib/user-context"
import { buildUnsubscribeUrl } from "@/lib/unsubscribe"
import { buildCampaignEmail } from "@/lib/email/build-campaign-email"
import { sendSesEmail } from "@/lib/ses"

export const runtime = "nodejs"
export const maxDuration = 60

// Never signs an unsubscribe token for a real buyer: the nil UUID resolves to no
// buyer, so the footer link is representative but harmless.
const TEST_BUYER_ID = "00000000-0000-0000-0000-000000000000"

export async function POST(request: NextRequest) {
  try {
    const { user, orgId, supabase } = await requireOrgContext()
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    if (!orgId) return NextResponse.json({ ok: false, error: "Missing org" }, { status: 400 })

    const denied = await requirePermission(supabase, "campaigns.send_email")
    if (denied) return denied

    let body: { campaignId?: string; to?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
    }

    const campaignId = typeof body.campaignId === "string" ? body.campaignId : ""
    const to = typeof body.to === "string" ? body.to.trim() : ""
    if (!campaignId || !to) {
      return NextResponse.json({ ok: false, error: "campaignId and to are required" }, { status: 400 })
    }
    if (!isValidEmailSyntax(to)) {
      return NextResponse.json({ ok: false, error: "Enter a valid email address" }, { status: 400 })
    }

    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .eq("org_id", orgId)
      .maybeSingle()
    if (campaignError || !campaign) {
      return NextResponse.json({ ok: false, error: "Campaign not found" }, { status: 404 })
    }

    if (campaign.channel !== "email") {
      return NextResponse.json({ ok: false, error: "Campaign must be an email campaign" }, { status: 400 })
    }
    if (!campaign.message?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Campaign has no content. Add a message before sending a test." },
        { status: 400 },
      )
    }
    if (!campaign.subject?.trim()) {
      return NextResponse.json({ ok: false, error: "Add a subject before sending a test." }, { status: 400 })
    }

    let sender
    try {
      sender = await resolveCampaignSender(orgId, {
        fromEmail: campaign.from_email,
        fromName: campaign.from_name,
      })
    } catch (err: any) {
      if (err instanceof SenderNotVerifiedError) {
        return apiError(err, 422, err.message, { ok: false })
      }
      console.error("[test-send] sender resolution failed", err)
      return NextResponse.json({ ok: false, error: "Failed to resolve email sender" }, { status: 500 })
    }

    const physicalAddress = process.env.EMAIL_PHYSICAL_ADDRESS?.trim() || ""
    if (!physicalAddress) {
      return NextResponse.json(
        { ok: false, error: "EMAIL_PHYSICAL_ADDRESS is not configured — required for CAN-SPAM compliance" },
        { status: 500 },
      )
    }

    const SITE_URL = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL
    if (!SITE_URL) {
      return NextResponse.json({ ok: false, error: "SITE_URL is not configured" }, { status: 500 })
    }

    // Replay the campaign-level transforms in the same order production uses:
    // /api/campaigns/send linkifies, then queueEmailCampaign stamps the org address.
    const linkified = linkifyHtml(campaign.message)
    const stamped = await stampBusinessAddressForCampaign(linkified, campaign.id)

    const senderContext = await getUserMergeContext(supabaseAdmin, campaign.user_id)

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name,display_name,phone")
      .eq("id", user.id)
      .maybeSingle()
    const { first, last } = splitName(profile?.full_name || profile?.display_name || "")
    const buyer = {
      fname: first || "there",
      lname: last || "",
      phone: profile?.phone || "",
      email: to,
    }

    const unsubscribeUrl = buildUnsubscribeUrl({ buyerId: TEST_BUYER_ID, email: to, baseUrl: SITE_URL })

    const built = buildCampaignEmail({
      rawSubject: campaign.subject,
      rawHtml: stamped,
      buyer,
      senderContext,
      unsubscribeUrl,
      physicalAddress,
    })

    await sendSesEmail({
      to,
      subject: `[TEST] ${built.subject}`,
      html: built.html,
      text: built.text,
      fromEmail: sender.fromEmail,
      fromName: sender.fromName,
      replyTo: sender.replyTo,
      unsubscribeUrl,
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err: any) {
    console.error("[test-send] failed", err)
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to send test email" },
      { status: 500 },
    )
  }
}
