import { notFound } from "next/navigation"

import MainLayout from "@/components/layout/main-layout"
import { estimateCarrierCost } from "@/lib/onboarding/carrier-cost"
import { checkUrlLoads } from "@/lib/onboarding/url-check"
import { orgIdentityFromRow, type OrgIdentityRow } from "@/lib/org-identity"
import { resolveComplianceUrls } from "@/lib/org-twilio/compliance-urls"
import { supabaseAdmin } from "@/lib/supabase"
import { requirePlatformAdminPage } from "../../require-platform-admin"
import { ApprovalDetail, type ApprovalView } from "./approval-detail"

export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

export default async function ApprovalDetailPage({ params }: { params: { orgId: string } }) {
  await requirePlatformAdminPage()
  const orgId = params.orgId
  if (!UUID_RE.test(orgId)) notFound()

  const [{ data: org }, { data: bv }, { data: row }] = await Promise.all([
    supabaseAdmin
      .from("organizations")
      .select("name, business_name, address_line1, address_line2, city, state, zip, country, phone, website_url")
      .eq("id", orgId)
      .maybeSingle(),
    supabaseAdmin.from("business_verification").select("*").eq("org_id", orgId).maybeSingle(),
    supabaseAdmin.from("org_twilio").select("*").eq("org_id", orgId).maybeSingle(),
  ])
  if (!org) notFound()

  const urls = await resolveComplianceUrls(orgId).catch(() => ({ error: "needs_website" as const }))
  let website: ApprovalView["website"] = { url: null, privacyUrl: null, termsUrl: null, privacyOk: false, termsOk: false }
  if (!("error" in urls)) {
    const [privacy, terms] = await Promise.all([checkUrlLoads(urls.privacyUrl), checkUrlLoads(urls.termsUrl)])
    website = { url: urls.websiteUrl, privacyUrl: urls.privacyUrl, termsUrl: urls.termsUrl, privacyOk: privacy.ok, termsOk: terms.ok }
  }

  const b = (bv ?? {}) as Record<string, unknown>
  const r = (row ?? {}) as Record<string, any>
  const identity = orgIdentityFromRow(org as OrgIdentityRow)
  const view: ApprovalView = {
    orgId,
    workspace: s((org as any).name) || orgId,
    businessName: s((org as any).business_name),
    legalName: s(b.legal_business_name),
    entityType: b.entity_type === "sole_proprietor" ? "Sole proprietor" : "Business with EIN",
    businessType: s(b.business_type),
    einLast4: s(b.ein).replace(/\D/g, "").slice(-4),
    address: identity.addressSingleLine,
    website,
    rep: {
      name: [s(b.contact_first_name), s(b.contact_last_name)].filter(Boolean).join(" "),
      title: [s(b.rep_title), s(b.rep_job_position)].filter(Boolean).join(" · "),
      email: s(b.contact_email),
      phone: s(b.rep_phone),
    },
    desiredNumber: s(r.desired_phone_number) || (r.desired_area_code ? `Any in ${r.desired_area_code}` : ""),
    phoneNumber: s(r.phone_number),
    mock: Boolean(r.mock_registration),
    hasBrand: Boolean(r.brand_sid),
    stage: s(r.setup_stage) || "not_started",
    spendApprovedAt: r.spend_approved_at ?? null,
    issues: Array.isArray(r.customer_issues) ? r.customer_issues.map((i: any) => String(i?.message ?? "")).filter(Boolean) : [],
    cost: estimateCarrierCost(r.brand_type).label,
    brandType: r.brand_type === "SOLE_PROPRIETOR" ? "Sole proprietor" : "Standard",
  }

  return (
    <MainLayout>
      <div className="min-h-full bg-muted/40 p-4 sm:p-6">
        <ApprovalDetail view={view} />
      </div>
    </MainLayout>
  )
}
