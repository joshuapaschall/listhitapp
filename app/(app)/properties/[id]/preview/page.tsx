import type { Metadata } from "next"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { resolveOrgIdForUser } from "@/lib/auth/org-context"
import { getDealByIdForOwner, getNearbyPublishedDeals } from "@/services/site-deals-service"
import { getPrimarySiteForOrg } from "@/lib/site-builder/resolve-site"
import { DEFAULT_THEME, DEFAULT_BUSINESS, DEFAULT_MARKETS } from "@/lib/site-builder/types"
import { buildOptInDisclosure } from "@/lib/site-builder/compliance"
import { locationHrefForDeal } from "@/lib/site-builder/location-pages"
import { PropertyPage } from "@/components/sites/property-page"

export const dynamic = "force-dynamic"

// Owner-only draft preview — never indexable.
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function PropertyPreviewPage({ params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const orgId = await resolveOrgIdForUser(user.id)
  if (!orgId) redirect("/login")

  const deal = await getDealByIdForOwner(orgId, params.id)
  if (!deal) notFound()

  const site = await getPrimarySiteForOrg(orgId)
  const theme = { ...DEFAULT_THEME, ...(site?.theme_json || {}) }
  const business = { ...DEFAULT_BUSINESS, ...(site?.business_json || {}) }
  const persona = site?.persona || "cash"
  const brandName = site?.name || "Your brand"
  const host = site?.slug ? `${site.slug}.listhit.io` : "preview.listhit.io"

  const nearby = await getNearbyPublishedDeals(orgId, deal.city, deal.state, deal.id, 3).catch(() => [])
  const cityLocationHref = site ? locationHrefForDeal(site, deal.city, deal.state) : null

  const formContext = {
    persona,
    brandName,
    optinEnabled: business.optin?.enabled !== false,
    requireConsent: business.optin?.requireConsent !== false,
    disclosure: buildOptInDisclosure(brandName),
    legalPaths: { terms: "/terms", privacy: "/privacy" },
    markets: { ...DEFAULT_MARKETS, ...((site?.markets_json as any) || {}) },
    deals: nearby,
    business,
  }

  const isDraft = (deal as any).show_on_site === false

  return (
    <>
      {isDraft ? (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#1f2937",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Draft preview — not published
        </div>
      ) : null}
      <PropertyPage
        host={host}
        site={site || {}}
        theme={theme}
        business={business}
        deal={deal}
        nearby={nearby}
        formContext={formContext}
        cityLocationHref={cityLocationHref}
      />
    </>
  )
}
