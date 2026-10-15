import { NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { upsertStepStatus } from "@/lib/onboarding/service"
import { supabaseAdmin } from "@/lib/supabase"
import { fetchSitePublicUrl } from "@/lib/websites/site-public-url"
import { SiteService } from "@/services/site-service"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

// "Create my buyer website": one click builds and publishes the ListHit buyer
// site from the business profile (same template, persona and pages the wizard
// defaults to), then records it as the org's website. Idempotent: an existing
// published site is reused, an existing draft is published.
export async function POST() {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return apiError("Unauthorized", 401)
  if (!orgId) return apiError("Missing org", 400)

  const { data: profile } = await supabaseAdmin.from("profiles").select("role, email").eq("id", user.id).maybeSingle()
  const role = (profile as { role?: string } | null)?.role
  if (role !== "owner" && role !== "admin") return apiError("Forbidden", 403)

  try {
    const sites = (await SiteService.list(supabase, orgId)) || []
    let site: any = sites.find((x: any) => x.status === "published") ?? sites[0] ?? null

    if (!site) {
      const [{ data: org }, { data: bv }] = await Promise.all([
        supabaseAdmin.from("organizations").select("name, business_name, address_line1, city, state, zip, phone").eq("id", orgId).maybeSingle(),
        supabaseAdmin.from("business_verification").select("dba_name, legal_business_name, contact_email").eq("org_id", orgId).maybeSingle(),
      ])
      const o = (org ?? {}) as Record<string, unknown>
      const v = (bv ?? {}) as Record<string, unknown>
      const name = s(v.dba_name) || s(o.business_name) || s(v.legal_business_name) || s(o.name) || "My buyer website"
      site = await SiteService.create(supabase, orgId, { name, persona: "cash", templateId: "marquee" })
      await SiteService.updateBusiness(supabase, site.id, {
        email: s(v.contact_email) || s((profile as { email?: string } | null)?.email),
        phone: s(o.phone),
        address: s(o.address_line1),
        city: s(o.city),
        state: s(o.state),
        zip: s(o.zip),
      })
    }

    if (site.status !== "published") {
      const published = await SiteService.publish(supabase, orgId, site.id)
      site = published.site
    }

    const websiteUrl = await fetchSitePublicUrl(supabaseAdmin, orgId, site.id, site.slug)
    const { error } = await supabaseAdmin.from("organizations").update({ website_url: websiteUrl }).eq("id", orgId)
    if (error) throw new Error(error.message)
    await upsertStepStatus(orgId, "website", "done")

    return NextResponse.json({ ok: true, site: { id: site.id, name: site.name, slug: site.slug }, website_url: websiteUrl })
  } catch (err) {
    return apiError(err, 500, "We couldn't create your website. Try again in a minute.")
  }
}
