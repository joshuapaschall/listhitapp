import { NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { requirePermission } from "@/lib/permissions/server"
import { resolveCampaignSender, SenderNotVerifiedError } from "@/lib/email-sender-resolver"
import { buildCampaignEmail } from "@/lib/email/build-campaign-email"
import { getOrgIdentity } from "@/lib/org-identity.server"
import { INCOMPLETE_ADDRESS_MESSAGE } from "@/lib/org-identity"
import { sendSesEmail } from "@/lib/ses"
import { supabaseAdmin } from "@/lib/supabase"
import { buildUnsubscribeUrl } from "@/lib/unsubscribe"
import { getUserMergeContext } from "@/lib/user-context"

export const runtime = "nodejs"
export const maxDuration = 60

// Same nil buyer as /api/campaigns/test-send: the unsubscribe link is real-looking but harmless.
const TEST_BUYER_ID = "00000000-0000-0000-0000-000000000000"

function escapeHtml(v: string) {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

// "Send a test email to yourself" from the email setup step. The same pipeline
// as the campaign test-send (verified sender, CAN-SPAM address gate, campaign
// email builder, SES) without needing a draft campaign.
export async function POST() {
  try {
    const { user, orgId, supabase } = await requireOrgContext()
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    if (!orgId) return NextResponse.json({ ok: false, error: "Missing org" }, { status: 400 })
    const denied = await requirePermission(supabase, "campaigns.send_email")
    if (denied) return denied

    const to = (user.email || "").trim()
    if (!to) return NextResponse.json({ ok: false, error: "Your account has no email address." }, { status: 400 })

    let sender
    try {
      sender = await resolveCampaignSender(orgId, { fromEmail: null, fromName: null })
    } catch (err) {
      if (err instanceof SenderNotVerifiedError) {
        return NextResponse.json({ ok: false, error: "Choose your from address first." }, { status: 422 })
      }
      throw err
    }

    const identity = await getOrgIdentity(orgId)
    if (!identity?.hasCompleteAddress) {
      return NextResponse.json({ ok: false, error: INCOMPLETE_ADDRESS_MESSAGE, code: "missing_business_address" }, { status: 400 })
    }

    const SITE_URL = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL
    if (!SITE_URL) return NextResponse.json({ ok: false, error: "We couldn't send a test right now." }, { status: 500 })

    const senderContext = await getUserMergeContext(supabaseAdmin, user.id)
    const unsubscribeUrl = buildUnsubscribeUrl({ buyerId: TEST_BUYER_ID, email: to, baseUrl: SITE_URL })
    const name = escapeHtml(identity.companyName)
    const built = buildCampaignEmail({
      rawSubject: `Your ListHit email is working`,
      rawHtml: `<p>Hi {{first_name}},</p><p>This is a test from ${name}. If you're reading this in your inbox, your email sending is set up and buyers will get your emails from ${escapeHtml(sender.fromEmail)}.</p>`,
      buyer: { fname: "there", lname: "", phone: "", email: to },
      senderContext,
      unsubscribeUrl,
      physicalAddress: identity.addressSingleLine,
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
    return NextResponse.json({ ok: true, to })
  } catch (err) {
    console.error("[onboarding-email-test] failed", err)
    return NextResponse.json({ ok: false, error: "We couldn't send a test right now. Try again in a minute." }, { status: 500 })
  }
}
