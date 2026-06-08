import { NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { dnsRecordsFor, getProjectDomain, verifyProjectDomain, vercelConfigured } from "@/lib/vercel/domains"

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

    const { data: updated, error } = await supabase
      .from("site_domains")
      .update({
        status: verified ? "active" : "pending",
        verification: result.verification ?? row.verification,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId)
      .eq("id", domainId)
      .select("*")
      .single()
    if (error) throw error

    return NextResponse.json({
      ok: true,
      domain: { ...updated, dns_records: dnsRecordsFor(updated.domain, updated.verification) },
    })
  } catch (err) {
    return apiError(err, 500, undefined, { ok: false })
  }
}
