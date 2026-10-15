import "server-only"

import { supabaseAdmin } from "@/lib/supabase"
import { isOrgTelnyxPinnedEnv } from "@/lib/providers/sms/routing"
import { publicUrlFor } from "@/lib/websites/site-public-url"
import {
  deriveSetupSummary,
  type OutcomeData,
  type SetupSummary,
  type TextingStage,
} from "@/lib/onboarding/outcome-types"

export * from "@/lib/onboarding/outcome-types"

// Loads everything the setup hub derives its outcomes from. Nothing here is a
// "mark as done" flag — each outcome reads the real records it describes.

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

export async function loadOutcomeData(orgId: string, userId?: string): Promise<OutcomeData> {
  const pinned = isOrgTelnyxPinnedEnv(orgId)

  const [bvRes, orgRes, a2pRes, sitesRes, customRes, domainsRes, sendersRes, twilioRes, buyersRes, profileRes] = await Promise.all([
    supabaseAdmin
      .from("business_verification")
      .select("status, legal_business_name, ein, contact_first_name, contact_email")
      .eq("org_id", orgId)
      .maybeSingle(),
    supabaseAdmin.from("organizations").select("website_url").eq("id", orgId).maybeSingle(),
    supabaseAdmin.from("a2p_registration").select("privacy_policy_url, terms_url").eq("org_id", orgId).maybeSingle(),
    supabaseAdmin.from("sites").select("id, slug, status").eq("org_id", orgId),
    supabaseAdmin
      .from("site_domains")
      .select("site_id, domain, created_at")
      .eq("org_id", orgId)
      .eq("type", "custom")
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("email_domains").select("id, domain, status").eq("org_id", orgId),
    supabaseAdmin.from("email_senders").select("domain_id, from_email, is_default").eq("org_id", orgId),
    supabaseAdmin.from("org_twilio").select("setup_stage, phone_number").eq("org_id", orgId).maybeSingle(),
    supabaseAdmin.from("buyers").select("id", { count: "exact", head: true }).eq("org_id", orgId).is("deleted_at", null),
    userId
      ? supabaseAdmin.from("profiles").select("full_name").eq("id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const bv = (bvRes.data ?? null) as Record<string, unknown> | null
  const sites = ((sitesRes.data ?? []) as Array<{ id: string; slug: string; status: string }>)
  const published = sites.find((s) => s.status === "published") ?? null
  const customDomains = (customRes.data ?? []) as Array<{ site_id: string; domain: string }>
  const custom = published ? customDomains.find((d) => d.site_id === published.id)?.domain ?? null : null

  const domains = (domainsRes.data ?? []) as Array<{ id: string; domain: string; status: string }>
  const senders = (sendersRes.data ?? []) as Array<{ domain_id: string; from_email: string; is_default: boolean }>
  const verified = domains.filter((d) => d.status === "verified")
  const verifiedIds = new Set(verified.map((d) => d.id))
  const sender =
    senders.filter((s) => verifiedIds.has(s.domain_id)).sort((a, b) => Number(b.is_default) - Number(a.is_default))[0] ?? null
  const verifiedDomain = sender ? verified.find((d) => d.id === sender.domain_id)?.domain ?? null : verified[0]?.domain ?? null
  const pendingDomain = domains.find((d) => d.status !== "verified")?.domain ?? null

  const twilio = (twilioRes.data ?? null) as { setup_stage?: string | null; phone_number?: string | null } | null
  const fullName = str((profileRes.data as { full_name?: string | null } | null)?.full_name)

  return {
    pinned,
    firstName: fullName.split(/\s+/)[0] || null,
    business: {
      status: (bv?.status as "draft" | "ready" | undefined) ?? null,
      hasAnyDetails: Boolean(bv && (str(bv.legal_business_name) || str(bv.ein) || str(bv.contact_first_name) || str(bv.contact_email))),
    },
    website: {
      publishedSiteUrl: published ? publicUrlFor(published.slug, custom) : null,
      hasDraftSite: sites.length > 0 && !published,
      websiteUrl: str((orgRes.data as { website_url?: string | null } | null)?.website_url) || null,
      privacyUrl: str((a2pRes.data as { privacy_policy_url?: string | null } | null)?.privacy_policy_url) || null,
      termsUrl: str((a2pRes.data as { terms_url?: string | null } | null)?.terms_url) || null,
      customDomain: custom,
    },
    email: { verifiedDomain, pendingDomain, fromAddress: sender?.from_email ?? null },
    texting: { stage: ((twilio?.setup_stage as TextingStage) || "not_started"), phoneNumber: twilio?.phone_number ?? null },
    buyers: { count: buyersRes.count ?? 0 },
  }
}

export async function getSetupSummary(orgId: string, userId?: string): Promise<SetupSummary> {
  return deriveSetupSummary(await loadOutcomeData(orgId, userId))
}
