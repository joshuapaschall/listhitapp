import "server-only"

import { insertNotification } from "@/lib/notifications"
import { sendPlatformEmail } from "@/lib/email/send-platform-email"
import { actionNeededEmail, adminAwaitingApprovalEmail, textingLiveEmail, type RenderedEmail } from "@/lib/email/templates"
import { estimateCarrierCost } from "@/lib/onboarding/carrier-cost"
import { checkUrlLoads } from "@/lib/onboarding/url-check"
import { resolveComplianceUrls } from "@/lib/org-twilio/compliance-urls"
import { supabaseAdmin } from "@/lib/supabase"
import type { CustomerIssue } from "@/lib/org-twilio/issues"

// Registration notifications. Callers decide WHEN (once per event, tracked on
// org_twilio); these only deliver. Every send is best-effort: a failed email
// must never fail a registration step.

type Recipient = { email: string; firstName: string | null }

async function orgAdmins(orgId: string): Promise<Recipient[]> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("email, full_name, role")
    .eq("org_id", orgId)
    .in("role", ["owner", "admin"])
  if (error) {
    console.error("[org-twilio-notify] org admin lookup failed", { orgId, error })
    return []
  }
  const seen = new Set<string>()
  const out: Recipient[] = []
  for (const r of (data ?? []) as Array<{ email: string | null; full_name: string | null }>) {
    const email = (r.email ?? "").trim()
    if (!email || seen.has(email.toLowerCase())) continue
    seen.add(email.toLowerCase())
    out.push({ email, firstName: (r.full_name ?? "").trim().split(/\s+/)[0] || null })
  }
  return out
}

async function businessName(orgId: string): Promise<{ name: string; business: string }> {
  const { data } = await supabaseAdmin.from("organizations").select("name, business_name").eq("id", orgId).maybeSingle()
  const row = (data ?? {}) as { name?: string | null; business_name?: string | null }
  const name = (row.name ?? "").trim()
  return { name: name || orgId, business: (row.business_name ?? "").trim() || name }
}

async function deliver(to: string, email: RenderedEmail, category: Parameters<typeof sendPlatformEmail>[0]["category"]) {
  const result = await sendPlatformEmail({ to, subject: email.subject, html: email.html, text: email.text, category })
  if (!result.sent) console.error("[org-twilio-notify] email failed", { category, error: result.error })
}

export async function notifyLive(orgId: string, phoneNumber: string | null) {
  const phone = phoneNumber || "your number"
  const body = `Your number ${phone} is approved by the carriers. You can text your buyers now.`
  await insertNotification({ type: "texting_live", title: "Texting is live", orgId, body })
  const { business } = await businessName(orgId)
  const approvedAt = new Date().toISOString()
  for (const r of await orgAdmins(orgId)) {
    await deliver(r.email, textingLiveEmail({ firstName: r.firstName, phoneNumber, approvedAt, business }), "texting_live")
  }
}

export async function notifyActionRequired(orgId: string, issues: CustomerIssue[]) {
  await insertNotification({
    type: "texting_action_required",
    title: "Action needed to finish texting setup",
    orgId,
    body: issues.map((i) => i.message).join(" "),
    metadata: { link: "/getting-started/texting" },
  })
  const { business } = await businessName(orgId)
  const email = actionNeededEmail({ issues: issues.map((i) => i.message), business })
  for (const r of await orgAdmins(orgId)) await deliver(r.email, email, "texting_action_required")
}

function platformAdminIds(): string[] {
  return (process.env.PLATFORM_ADMIN_USER_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
}

export async function notifyPlatformAdminsAwaitingApproval(orgId: string, brandType: string | null) {
  const { name } = await businessName(orgId)
  const { data: bv } = await supabaseAdmin
    .from("business_verification")
    .select("legal_business_name, ein")
    .eq("org_id", orgId)
    .maybeSingle()
  const bvRow = (bv ?? {}) as { legal_business_name?: string | null; ein?: string | null }
  const einLast4 = (bvRow.ein ?? "").replace(/\D/g, "").slice(-4)
  const sole = brandType === "SOLE_PROPRIETOR"
  const typeLabel = sole ? "Sole proprietor" : `Standard${einLast4 ? ` · EIN ending ${einLast4}` : ""}`

  let website = ""
  let websiteOk = false
  try {
    const urls = await resolveComplianceUrls(orgId)
    if (!("error" in urls)) {
      website = urls.websiteUrl
      const [privacy, terms] = await Promise.all([checkUrlLoads(urls.privacyUrl), checkUrlLoads(urls.termsUrl)])
      websiteOk = privacy.ok && terms.ok
    }
  } catch (err) {
    console.error("[org-twilio-notify] website check failed", { orgId }, err)
  }

  const email = adminAwaitingApprovalEmail({
    orgId,
    workspace: name,
    business: (bvRow.legal_business_name ?? "").trim() || name,
    typeLabel,
    website,
    websiteOk,
    estimatedCost: estimateCarrierCost(brandType).label,
  })

  for (const id of platformAdminIds()) {
    try {
      const { data } = await supabaseAdmin.auth.admin.getUserById(id)
      const to = data?.user?.email
      if (to) await deliver(to, email, "admin_awaiting_approval")
    } catch (err) {
      console.error("[org-twilio-notify] platform admin lookup failed", { id }, err)
    }
  }
}
