import "server-only"

import { supabaseAdmin } from "@/lib/supabase"
import { fetchSitePublicUrl } from "@/lib/websites/site-public-url"

// The website, privacy policy and terms URLs an org's A2P campaign cites. They
// must be pages that really exist: carriers open them during review, and a
// campaign that points at a 404 (or at another company's policies) is rejected.
//
//   1. A published ListHit site: its own /privacy and /terms pages, which the
//      site renderer always serves.
//   2. Otherwise the org's own website, but ONLY with privacy and terms URLs the
//      customer entered. We never guess `<their site>/privacy`.
//   3. Otherwise the org needs a website before it can register.

export type ComplianceUrls =
  | { websiteUrl: string; privacyUrl: string; termsUrl: string; hasListHitSite: boolean }
  | { error: "needs_website" }

function httpsUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const v = raw.trim()
  if (!v) return null
  try {
    const u = new URL(v)
    return u.protocol === "https:" ? u.toString().replace(/\/$/, "") : null
  } catch {
    return null
  }
}

export async function resolveComplianceUrls(orgId: string): Promise<ComplianceUrls> {
  const [{ data: org }, { data: site }, { data: a2p }] = await Promise.all([
    supabaseAdmin.from("organizations").select("website_url").eq("id", orgId).maybeSingle(),
    supabaseAdmin
      .from("sites")
      .select("id, slug")
      .eq("org_id", orgId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("a2p_registration")
      .select("privacy_policy_url, terms_url")
      .eq("org_id", orgId)
      .maybeSingle(),
  ])

  const orgWebsite = httpsUrl((org as { website_url?: string | null } | null)?.website_url)

  const siteRow = site as { id: string; slug: string } | null
  if (siteRow?.id && siteRow.slug) {
    const siteUrl = (await fetchSitePublicUrl(supabaseAdmin, orgId, siteRow.id, siteRow.slug)).replace(/\/$/, "")
    return {
      websiteUrl: orgWebsite ?? siteUrl,
      privacyUrl: `${siteUrl}/privacy`,
      termsUrl: `${siteUrl}/terms`,
      hasListHitSite: true,
    }
  }

  const reg = a2p as { privacy_policy_url?: string | null; terms_url?: string | null } | null
  const privacyUrl = httpsUrl(reg?.privacy_policy_url)
  const termsUrl = httpsUrl(reg?.terms_url)
  if (orgWebsite && privacyUrl && termsUrl) {
    return { websiteUrl: orgWebsite, privacyUrl, termsUrl, hasListHitSite: false }
  }

  return { error: "needs_website" }
}
