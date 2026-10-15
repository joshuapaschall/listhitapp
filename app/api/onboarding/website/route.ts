import { NextRequest, NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { supabaseAdmin } from "@/lib/supabase"
import { SiteService } from "@/services/site-service"
import { upsertStepStatus } from "@/lib/onboarding/service"
import { checkUrlLoads, normalizeHttpsUrl } from "@/lib/onboarding/url-check"
import { fetchSitePublicUrl } from "@/lib/websites/site-public-url"

export const dynamic = "force-dynamic"

// Mirror the organization PATCH gate: only owner/admin may write.
async function requireOwnerAdmin(userId: string): Promise<boolean> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle()
  const role = profile?.role
  return role === "owner" || role === "admin"
}

const COULD_NOT_OPEN = "We couldn't open this page"

export async function PUT(request: NextRequest) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return apiError("Unauthorized", 401)
  if (!orgId) return apiError("Missing org", 400)

  if (!(await requireOwnerAdmin(user.id))) return apiError("Forbidden", 403)

  let body: { source?: string; url?: unknown; privacyUrl?: unknown; termsUrl?: unknown }
  try {
    body = await request.json()
  } catch {
    return apiError("Invalid JSON body", 400)
  }

  try {
    if (body.source === "listhit") {
      const sites = await SiteService.list(supabase, orgId)
      const published = (sites || []).find((s: any) => s.status === "published")
      if (!published) return NextResponse.json({ error: "Publish your ListHit site first." }, { status: 400 })
      // An active custom domain wins over the free *.listhit.io address.
      const websiteUrl = await fetchSitePublicUrl(supabaseAdmin, orgId, published.id, published.slug)
      const { error } = await supabaseAdmin.from("organizations").update({ website_url: websiteUrl }).eq("id", orgId)
      if (error) throw new Error(error.message)
      await upsertStepStatus(orgId, "website", "done")
      return NextResponse.json({ ok: true, website_url: websiteUrl })
    }

    if (body.source !== "external") return apiError("Invalid source", 400)

    const websiteUrl = normalizeHttpsUrl(body.url)
    const privacyUrl = normalizeHttpsUrl(body.privacyUrl)
    const termsUrl = normalizeHttpsUrl(body.termsUrl)
    const fieldErrors: Record<string, string> = {}
    if (!websiteUrl) fieldErrors.url = "Enter your website address, like https://yourbrand.com"
    if (!privacyUrl) fieldErrors.privacyUrl = "Enter the address of your privacy policy page"
    if (!termsUrl) fieldErrors.termsUrl = "Enter the address of your terms page"
    if (Object.keys(fieldErrors).length) return NextResponse.json({ error: "Check the highlighted fields.", fieldErrors }, { status: 422 })

    // Carriers open every one of these during review; they must load.
    const [site, privacy, terms] = await Promise.all([
      checkUrlLoads(websiteUrl!),
      checkUrlLoads(privacyUrl!),
      checkUrlLoads(termsUrl!),
    ])
    const checks = { url: site.ok, privacyUrl: privacy.ok, termsUrl: terms.ok }
    if (!site.ok) fieldErrors.url = COULD_NOT_OPEN
    if (!privacy.ok) fieldErrors.privacyUrl = COULD_NOT_OPEN
    if (!terms.ok) fieldErrors.termsUrl = COULD_NOT_OPEN
    if (Object.keys(fieldErrors).length) {
      return NextResponse.json({ error: "We couldn't open one of these pages. Check the address and try again.", fieldErrors, checks }, { status: 422 })
    }

    const { error: orgErr } = await supabaseAdmin.from("organizations").update({ website_url: websiteUrl }).eq("id", orgId)
    if (orgErr) throw new Error(orgErr.message)
    const { error: a2pErr } = await supabaseAdmin
      .from("a2p_registration")
      .upsert(
        { org_id: orgId, use_case: "marketing", privacy_policy_url: privacyUrl, terms_url: termsUrl, updated_at: new Date().toISOString() },
        { onConflict: "org_id" },
      )
    if (a2pErr) throw new Error(a2pErr.message)

    await upsertStepStatus(orgId, "website", "done")
    return NextResponse.json({ ok: true, website_url: websiteUrl, checks })
  } catch (err) {
    return apiError(err, 500)
  }
}
