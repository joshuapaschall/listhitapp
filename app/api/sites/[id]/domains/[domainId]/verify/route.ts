import { NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { checkHttps } from "@/lib/dns/inspect"
import { notifyWebsiteLiveOnce } from "@/lib/onboarding/notify-connected"
import {
  dnsRecordsFor,
  domainStatusFrom,
  getDomainConfig,
  getProjectDomain,
  verifyProjectDomain,
  vercelConfigured,
} from "@/lib/vercel/domains"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string; domainId: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ ok: false, error: "Organization context missing" }, { status: 400 })

  const { id: siteId, domainId } = await context.params
  try {
    const { data: site } = await supabase.from("sites").select("id").eq("id", siteId).eq("org_id", orgId).maybeSingle()
    if (!site) return NextResponse.json({ ok: false, error: "Site not found" }, { status: 404 })

    const { data: row } = await supabase
      .from("site_domains")
      .select("*")
      .eq("org_id", orgId)
      .eq("site_id", siteId)
      .eq("id", domainId)
      .maybeSingle()
    if (!row) return NextResponse.json({ ok: false, error: "Domain not found" }, { status: 404 })

    if (!vercelConfigured()) {
      return NextResponse.json({ ok: false, error: "Domain hosting isn't configured yet." }, { status: 503 })
    }

    // The verify call triggers a re-check; a "still pending" failure is non-fatal.
    // The subsequent get returns the authoritative current state.
    await verifyProjectDomain(row.domain).catch(() => null)
    const result = await getProjectDomain(row.domain)
    const verified = Boolean(result.verified)
    // `verified` only proves ownership; active also needs misconfigured === false
    // (DNS really points at Vercel). A failed config check leaves it pending.
    const config = verified ? await getDomainConfig(row.domain).catch(() => null) : null

    const { data: updated, error } = await supabase
      .from("site_domains")
      .update({
        status: domainStatusFrom(verified, config),
        verification: result.verification ?? row.verification,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId)
      .eq("id", domainId)
      .select("*")
      .single()
    if (error) throw error

    // Live = active (DNS points at us) AND the site loads over https. SSL is
    // issued a little after DNS resolves; until then the card says "securing".
    const httpsOk = updated.status === "active" ? (await checkHttps(updated.domain)).ok : false
    if (httpsOk && !updated.live_notified_at) {
      if (await notifyWebsiteLiveOnce(orgId, updated.id, updated.domain)) updated.live_notified_at = new Date().toISOString()
    }

    return NextResponse.json({
      ok: true,
      domain: { ...updated, https_ok: httpsOk, dns_records: dnsRecordsFor(updated.domain, updated.verification) },
    })
  } catch (err) {
    return apiError(err, 500, undefined, { ok: false })
  }
}
