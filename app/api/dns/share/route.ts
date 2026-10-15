import { NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { detectProvider } from "@/lib/dns/inspect"
import { displayHost, providerGuide, providerSteps, stripBold } from "@/lib/dns/providers"
import { loadDnsTarget, parseDnsKind } from "@/lib/dns/targets"
import { sendPlatformEmail } from "@/lib/email/send-platform-email"
import { dnsShareEmail } from "@/lib/email/templates"
import { supabaseAdmin } from "@/lib/supabase"

export const dynamic = "force-dynamic"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MAX_PER_HOUR = 5
const MAX_NOTE = 500

// Email the exact records and provider steps to whoever manages the domain
// (a web person, the registrar's support). Org-scoped, 5 sends per org per hour.
export async function POST(request: Request) {
  const { user, orgId } = await requireOrgContext()
  if (!user) return apiError("Unauthorized", 401)
  if (!orgId) return apiError("Missing org", 400)

  const body = await request.json().catch(() => null)
  const kind = parseDnsKind(body?.kind)
  const id = typeof body?.id === "string" ? body.id.trim() : ""
  const toEmail = typeof body?.toEmail === "string" ? body.toEmail.trim().toLowerCase() : ""
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, MAX_NOTE) : ""
  if (!kind || !id) return apiError("kind (website|email) and id are required", 400)
  if (!EMAIL_RE.test(toEmail)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })

  try {
    const target = await loadDnsTarget(orgId, kind, id)
    if (!target) return apiError("Domain not found", 404)

    const since = new Date(Date.now() - 3_600_000).toISOString()
    const { count, error: countErr } = await supabaseAdmin
      .from("dns_share_requests")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .gte("created_at", since)
    if (countErr) throw countErr
    if ((count ?? 0) >= MAX_PER_HOUR) {
      return NextResponse.json({ error: "You've sent these steps 5 times this hour. Try again a little later." }, { status: 429 })
    }

    const [{ data: org }, { data: profile }, detected] = await Promise.all([
      supabaseAdmin.from("organizations").select("name, business_name").eq("id", orgId).maybeSingle(),
      supabaseAdmin.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      detectProvider(target.domain),
    ])
    const orgRow = (org ?? {}) as { name?: string | null; business_name?: string | null }
    const businessName = (orgRow.business_name || orgRow.name || "").trim() || target.domain
    const guide = providerGuide(detected.key)

    const records = target.expected
      .filter((r) => !r.optional)
      .map((r) => ({ type: r.type, host: displayHost(r.host, target.zone, guide.hostFormat), value: r.value }))
    const steps = [...providerSteps(detected.key, records), ...(guide.warnings ?? [])].map(stripBold)
    if (guide.dnsUrl) steps[0] = `${steps[0].replace(/\s*\(button above\)\.?$/, ".")} ${guide.dnsUrl(target.zone)}`

    const email = dnsShareEmail({
      domain: target.domain,
      businessName,
      providerLabel: detected.label,
      steps,
      records,
      note,
      senderName: ((profile as { full_name?: string | null } | null)?.full_name || "").trim() || null,
    })
    const result = await sendPlatformEmail({
      to: toEmail,
      ...email,
      category: "dns_share",
      replyTo: user.email || undefined,
    })
    if (!result.sent) return NextResponse.json({ error: "We couldn't send that email. Try again in a minute." }, { status: 502 })

    await supabaseAdmin.from("dns_share_requests").insert({ org_id: orgId, user_id: user.id, to_email: toEmail, domain: target.domain, kind })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiError(err, 500)
  }
}
