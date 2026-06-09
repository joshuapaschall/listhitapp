import Link from "next/link"
import MainLayout from "@/components/layout/main-layout"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { loadOwnedSite } from "@/lib/websites/load-owned-site"
import { SiteHubNav } from "@/components/websites/site-hub-nav"
import { SiteDangerZone } from "@/components/websites/site-danger-zone"
import { CustomDomainCard } from "@/components/websites/custom-domain-card"

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
  const { site } = await loadOwnedSite(params.id, "id,name,slug,status")
  const published = site.status === "published"
  const domain = `${site.slug}.listhit.io`

  return (
    <MainLayout>
      <div className="space-y-6 p-4 md:p-6">
        <SiteHubNav active="settings" siteId={site.id} siteName={site.name} slug={site.slug} published={published} />

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Site basics</h2>
          <Field label="Name">{site.name}</Field>
          <Field label="Public URL">
            <span className="font-mono text-xs">{domain}</span>
          </Field>
          <Field label="Status">
            <Badge variant={published ? "default" : "secondary"}>{published ? "Published" : "Draft"}</Badge>
          </Field>
        </Card>

        <CustomDomainCard siteId={site.id} slug={site.slug} />

        <Card className="p-5">
          <h2 className="mb-2 text-sm font-semibold">Branding &amp; tracking</h2>
          <p className="text-sm text-muted-foreground">
            Branding, audience persona, markets, and ad tracking are all managed in the site editor.
          </p>
          <div className="mt-3">
            <Button asChild variant="outline">
              <Link href={`/websites/${site.id}/edit`}>Open site editor</Link>
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Danger zone</h2>
          <SiteDangerZone siteId={site.id} published={published} />
        </Card>
      </div>
    </MainLayout>
  )
}
