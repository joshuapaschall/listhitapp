import Link from "next/link"
import MainLayout from "@/components/layout/main-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { loadOwnedSite } from "@/lib/websites/load-owned-site"
import { SiteHubNav } from "@/components/websites/site-hub-nav"

export const dynamic = "force-dynamic"

const PERSONA_LABELS: Record<string, string> = {
  cash: "Cash buyers",
  investor: "Investors",
  rto: "Rent-to-own",
  owner: "Owner financing",
  creative: "Creative finance",
  land: "Land buyers",
  commercial: "Commercial",
  agent: "Agents",
}

const SWATCH_KEYS: { key: string; label: string }[] = [
  { key: "primary", label: "Primary" },
  { key: "accent", label: "Accent" },
]

export default async function WebsiteDesignPage({ params }: { params: { id: string } }) {
  const { site } = await loadOwnedSite(params.id, "id,name,slug,status,persona,theme_json")
  const published = site.status === "published"
  const domain = `${site.slug}.listhit.io`
  const theme = (site.theme_json || {}) as Record<string, any>
  const personaLabel = PERSONA_LABELS[site.persona] || site.persona || "—"
  const swatches = SWATCH_KEYS.filter((s) => typeof theme[s.key] === "string" && theme[s.key])

  return (
    <MainLayout>
      <div className="space-y-6 p-4 md:p-6">
        <SiteHubNav active="design" siteId={site.id} siteName={site.name} slug={site.slug} published={published} />

        <Card className="space-y-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-sm font-semibold">Theme</h2>
            <Button asChild variant="brand">
              <Link href={`/websites/${site.id}/edit`}>Open site editor</Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Audience</div>
              <div className="mt-1 text-sm font-medium text-foreground">{personaLabel}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">Brand colors</div>
              <div className="mt-2 flex flex-wrap gap-3">
                {swatches.length > 0 ? (
                  swatches.map((s) => (
                    <div key={s.key} className="flex items-center gap-2">
                      <span
                        className="h-6 w-6 rounded-md border border-border"
                        style={{ background: theme[s.key] }}
                      />
                      <span className="text-xs text-muted-foreground">{s.label}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">Pages</div>
              <div className="mt-1 text-sm text-foreground">Home · Properties · Blog · Legal</div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Live preview</h2>
          {published ? (
            <iframe
              src={`https://${domain}`}
              title="Site preview"
              loading="lazy"
              className="h-[360px] w-full rounded-xl border border-border"
            />
          ) : (
            <div className="flex h-[360px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
              Publish to preview
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  )
}
