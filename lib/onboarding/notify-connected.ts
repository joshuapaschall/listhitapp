import "server-only"

import { insertNotification } from "@/lib/notifications"
import { sendPlatformEmail } from "@/lib/email/send-platform-email"
import { emailReadyEmail, websiteLiveEmail, type RenderedEmail } from "@/lib/email/templates"
import { supabaseAdmin } from "@/lib/supabase"

// "Your domain is connected" emails. Each goes out exactly once: the caller's
// row is claimed with a conditional update (notified_at IS NULL), so two checks
// racing on the same domain can't both send. Best-effort — never throws.

async function adminEmails(orgId: string): Promise<string[]> {
  const { data } = await supabaseAdmin.from("profiles").select("email").eq("org_id", orgId).in("role", ["owner", "admin"])
  return Array.from(new Set(((data ?? []) as Array<{ email: string | null }>).map((r) => (r.email ?? "").trim()).filter(Boolean)))
}

async function businessName(orgId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("organizations").select("name, business_name").eq("id", orgId).maybeSingle()
  const row = (data ?? {}) as { name?: string | null; business_name?: string | null }
  return (row.business_name || row.name || "").trim() || null
}

async function claim(table: "site_domains" | "email_domains", column: string, orgId: string, id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from(table)
    .update({ [column]: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("id", id)
    .is(column, null)
    .select("id")
  if (error) {
    console.error("[notify-connected] claim failed", { table, id, error })
    return false
  }
  return Array.isArray(data) && data.length > 0
}

async function deliverAll(orgId: string, email: RenderedEmail, category: "website_live" | "email_ready") {
  for (const to of await adminEmails(orgId)) {
    const result = await sendPlatformEmail({ to, ...email, category })
    if (!result.sent) console.error("[notify-connected] email failed", { category, error: result.error })
  }
}

export async function notifyWebsiteLiveOnce(orgId: string, domainId: string, domain: string): Promise<boolean> {
  try {
    if (!(await claim("site_domains", "live_notified_at", orgId, domainId))) return false
    await insertNotification({ type: "website_live", title: `Your website is live at ${domain}`, orgId, body: `https://${domain} is connected and secure.` })
    await deliverAll(orgId, websiteLiveEmail({ domain, business: await businessName(orgId) }), "website_live")
    return true
  } catch (err) {
    console.error("[notify-connected] website live notify failed", { orgId, domain }, err)
    return false
  }
}

export async function notifyEmailReadyOnce(orgId: string, domainId: string, domain: string): Promise<boolean> {
  try {
    if (!(await claim("email_domains", "ready_notified_at", orgId, domainId))) return false
    const { data: sender } = await supabaseAdmin
      .from("email_senders")
      .select("from_email")
      .eq("org_id", orgId)
      .eq("domain_id", domainId)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle()
    const fromAddress = (sender as { from_email?: string } | null)?.from_email ?? null
    await insertNotification({ type: "email_ready", title: "Your email sending is set up", orgId, body: `Email from ${domain} is ready to send.` })
    await deliverAll(orgId, emailReadyEmail({ domain, fromAddress, business: await businessName(orgId) }), "email_ready")
    return true
  } catch (err) {
    console.error("[notify-connected] email ready notify failed", { orgId, domain }, err)
    return false
  }
}
