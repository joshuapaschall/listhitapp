import Link from "next/link"
import MainLayout from "@/components/layout/main-layout"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { loadOwnedSite } from "@/lib/websites/load-owned-site"
import { SiteHubNav } from "@/components/websites/site-hub-nav"
import { SiteDangerZone } from "@/components/websites/site-danger-zone"
import { CustomDomainCard } from "@/components/websites/custom-domain-card"
import { DealVisibilityCard } from "@/components/websites/deal-visibility-card"
import { BusinessDetailsForm } from "@/components/websites/business-details-form"
import { DEFAULT_BUSINESS, DEFAULT_MARKETS } from "@/lib/site-builder/types"

export const dynamic = "force-dynamic"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{children}</span>
    </div>
  )
}

export default async function WebsiteSettingsPage({ params }: { params: { id: string } }) {
  const { site, publicUrl } = await loadOwnedSite(params.id, "id,name,slug,status,deals_public,business_json,markets_json,tracking_json")
  const published = site.status === "published"
  const publicHost = publicUrl ? publicUrl.replace(/^https?:\/\//, "") : site.slug
  const business = { ...DEFAULT_BUSINESS, ...((site as any).business_json || {}) }
  const markets = { ...DEFAULT_MARKETS, ...((site as any).markets_json || {}) }
  const tracking = (site as any).tracking_json || {}

  return (
    <MainLayout>
      <div className="space-y-6 p-4 md:p-6">
        <SiteHubNav active="settings" siteId={site.id} siteName={site.name} slug={site.slug} published={published} publicUrl={publicUrl} />

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Site basics</h2>
          <Field label="Name">{site.name}</Field>
          <Field label="Public URL">
            <span className="font-mono text-xs">{publicHost}</span>
          </Field>
          <Field label="Status">
            <Badge variant={published ? "default" : "secondary"}>{published ? "Published" : "Draft"}</Badge>
          </Field>
        </Card>

        <CustomDomainCard siteId={site.id} slug={site.slug} />

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Business details</h2>
          <BusinessDetailsForm siteId={site.id} initialName={site.name} initialBusiness={business} initialMarkets={markets} initialTracking={tracking} />
        </Card>

        <Card className="p-5">
          <h2 className="mb-2 text-sm font-semibold">Branding</h2>
          <p className="text-sm text-muted-foreground">
            Your colors, logo, fonts, and template are edited in the studio.
          </p>
          <div className="mt-3">
            <Button asChild variant="outline">
              <Link href={`/websites/${site.id}/studio`}>Edit branding</Link>
            </Button>
          </div>
        </Card>

        <DealVisibilityCard siteId={site.id} initialPublic={site.deals_public !== false} />

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Danger zone</h2>
          <SiteDangerZone siteId={site.id} published={published} siteName={site.name} />
        </Card>
      </div>
    </MainLayout>
  )
}
