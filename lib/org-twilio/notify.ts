import "server-only"

import { insertNotification } from "@/lib/notifications"
import { FROM_EMAIL, resend } from "@/lib/resend"
import { supabaseAdmin } from "@/lib/supabase"
import type { CustomerIssue } from "@/lib/org-twilio/issues"

// Registration notifications. Callers decide WHEN (once per event, tracked on
// org_twilio); these only deliver. Every send is best-effort: a failed email
// must never fail a registration step.

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function appUrl(path: string) {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")
  return base ? `${base}${path}` : path
}

async function orgAdminEmails(orgId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("email, role")
    .eq("org_id", orgId)
    .in("role", ["owner", "admin"])
  if (error) {
    console.error("[org-twilio-notify] org admin lookup failed", { orgId, error })
    return []
  }
  return Array.from(
    new Set(((data ?? []) as Array<{ email: string | null }>).map((r) => (r.email ?? "").trim()).filter(Boolean)),
  )
}

async function sendEmail(to: string[], subject: string, html: string) {
  if (!resend || !to.length) return
  for (const recipient of to) {
    try {
      await resend.emails.send({ from: FROM_EMAIL, to: recipient, subject, html })
    } catch (err) {
      console.error("[org-twilio-notify] email failed", { subject }, err)
    }
  }
}

export async function notifyLive(orgId: string, phoneNumber: string | null) {
  const phone = phoneNumber || "your number"
  const body = `Your number ${phone} is approved by the carriers. You can text your buyers now.`
  await insertNotification({ type: "texting_live", title: "Texting is live", orgId, body })
  await sendEmail(
    await orgAdminEmails(orgId),
    "Texting is live on ListHit",
    `<p>${escapeHtml(body)}</p>`,
  )
}

export async function notifyActionRequired(orgId: string, issues: CustomerIssue[]) {
  const link = appUrl("/getting-started")
  const items = issues.map((i) => `<li>${escapeHtml(i.message)}</li>`).join("")
  await insertNotification({
    type: "texting_action_required",
    title: "Action needed to finish texting setup",
    orgId,
    body: issues.map((i) => i.message).join(" "),
    metadata: { link: "/getting-started" },
  })
  await sendEmail(
    await orgAdminEmails(orgId),
    "Action needed to finish texting setup",
    `<p>Your texting setup needs a few changes:</p><ul>${items}</ul><p><a href="${escapeHtml(link)}">Finish setup</a></p>`,
  )
}

function platformAdminIds(): string[] {
  return (process.env.PLATFORM_ADMIN_USER_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
}

export async function notifyPlatformAdminsAwaitingApproval(orgId: string, brandType: string | null) {
  const { data: org } = await supabaseAdmin.from("organizations").select("name").eq("id", orgId).maybeSingle()
  const orgName = ((org as { name?: string | null } | null)?.name ?? "").trim() || orgId

  const emails: string[] = []
  for (const id of platformAdminIds()) {
    try {
      const { data } = await supabaseAdmin.auth.admin.getUserById(id)
      const email = data?.user?.email
      if (email) emails.push(email)
    } catch (err) {
      console.error("[org-twilio-notify] platform admin lookup failed", { id }, err)
    }
  }

  await sendEmail(
    emails,
    `ListHit: ${orgName} submitted texting registration`,
    `<p>${escapeHtml(orgName)} (${escapeHtml(orgId)}) submitted a ${escapeHtml(brandType || "STANDARD")} texting registration.</p>` +
      `<p>Approve in /api/admin/org-twilio/approve with {"orgId": "${escapeHtml(orgId)}"}.</p>`,
  )
}
