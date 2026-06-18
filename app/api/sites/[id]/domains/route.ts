import { NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { addProjectDomain, dnsRecordsFor, vercelConfigured } from "@/lib/vercel/domains"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

const DOMAIN_RE = /^(?=.{1,253}$)(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/

function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.+$/, "")
}

async function siteInOrg(supabase: any, siteId: string, orgId: string): Promise<boolean> {
  const { data } = await supabase.from("sites").select("id").eq("id", siteId).eq("org_id", orgId).maybeSingle()
  return Boolean(data)
}

export async function GET(_request: Request, context: RouteContext) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ ok: false, error: "Organization context missing" }, { status: 400 })

  const { id: siteId } = await context.params
  try {
    if (!(await siteInOrg(supabase, siteId, orgId))) {
      return NextResponse.json({ ok: false, error: "Site not found" }, { status: 404 })
    }

    const { data, error } = await supabase
      .from("site_domains")
      .select("*")
      .eq("org_id", orgId)
      .eq("site_id", siteId)
      .eq("type", "custom")
      .order("created_at", { ascending: false })
    if (error) throw error

    const domains = (data || []).map((row: any) => ({
      ...row,
      dns_records: dnsRecordsFor(row.domain, row.verification),
    }))
    return NextResponse.json({ ok: true, configured: vercelConfigured(), domains })
  } catch (err) {
    return apiError(err, 500, undefined, { ok: false })
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ ok: false, error: "Organization context missing" }, { status: 400 })

  const { id: siteId } = await context.params
  try {
    if (!(await siteInOrg(supabase, siteId, orgId))) {
      return NextResponse.json({ ok: false, error: "Site not found" }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const domain = typeof body?.domain === "string" ? normalizeDomain(body.domain) : ""
    if (!DOMAIN_RE.test(domain)) {
      return NextResponse.json({ ok: false, error: "Enter a valid domain like homes.yourbrand.com." }, { status: 400 })
    }

    // Reject the platform's own space — that's the free subdomain, not a custom domain.
    const root = (process.env.SITES_ROOT_DOMAIN || "listhit.io").toLowerCase()
    const appHost = (process.env.NEXT_PUBLIC_APP_HOST || "").toLowerCase()
    if (domain === root || domain.endsWith(`.${root}`)) {
      return NextResponse.json(
        { ok: false, error: "That's your free subdomain — add a domain you own instead." },
        { status: 400 },
      )
    }
    if (appHost && domain === appHost) {
      return NextResponse.json({ ok: false, error: "That domain isn't available." }, { status: 400 })
    }

    if (!vercelConfigured()) {
      return NextResponse.json({ ok: false, error: "Domain hosting isn't configured yet." }, { status: 503 })
    }

    const result = await addProjectDomain(domain).catch((e: any) => {
      // Vercel blocks a domain that's already attached to another project (or this one).
      // Convert that one known, expected case to a sentinel so we can return a clear 409.
      if (e?.code === "domain_already_in_use" || e?.status === 409) return null
      throw e
    })
    if (!result) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "That domain is already connected somewhere else. If you own it, disconnect it from its current setup first, or connect a subdomain like deals.yourbrand.com instead.",
        },
        { status: 409 },
      )
    }

    const { data: inserted, error } = await supabase
      .from("site_domains")
      .insert({
        org_id: orgId,
        site_id: siteId,
        domain,
        type: "custom",
        vercel_domain_id: result.name,
        verification: result.verification ?? null,
        status: result.verified ? "active" : "pending",
      })
      .select("*")
      .single()
    if (error) {
      if ((error as any).code === "23505") {
        return NextResponse.json({ ok: false, error: "That domain is already connected." }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({
      ok: true,
      domain: { ...inserted, dns_records: dnsRecordsFor(domain, result.verification) },
    })
  } catch (err) {
    return apiError(err, 500, undefined, { ok: false })
  }
}
