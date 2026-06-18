import Link from "next/link"
import MainLayout from "@/components/layout/main-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { loadOwnedSite } from "@/lib/websites/load-owned-site"
import { SiteHubNav } from "@/components/websites/site-hub-nav"

export const dynamic = "force-dynamic"

const DAY_MS = 86_400_000

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-2 text-[27px] font-[650] leading-none tracking-tight text-foreground tabular-nums">{value}</div>
    </Card>
  )
}

export default async function WebsiteOverviewPage({ params }: { params: { id: string } }) {
  const { supabase, orgId, site } = await loadOwnedSite(params.id, "id,name,slug,status")
  const published = site.status === "published"

  const to = new Date()
  const from = new Date(to.getTime() - 30 * DAY_MS)

  // Em-dash on null/error — never fake a zero.
  const fmt = (n: number | null | undefined) =>
    n == null || !Number.isFinite(n) ? "—" : Number(n).toLocaleString()

  let visits: number | null = null
  let signups: number | null = null
  try {
    const { data, error } = await supabase.rpc("site_analytics_summary", {
      p_site_id: site.id,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    })
    const row = (data?.[0] || null) as { visits?: number; signups?: number } | null
    if (!error && row) {
      visits = Number(row.visits ?? 0)
      signups = Number(row.signups ?? 0)
    }
  } catch {
    /* leave as null → em-dash */
  }

  let liveListings: number | null = null
  try {
    const { count, error } = await supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("show_on_site", true)
      .eq("status", "available")
    if (!error) liveListings = count ?? null
  } catch {
    /* leave as null → em-dash */
  }

  return (
    <MainLayout>
      <div className="space-y-6 p-4 md:p-6">
        <SiteHubNav active="overview" siteId={site.id} siteName={site.name} slug={site.slug} published={published} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricTile label="Visitors · 30d" value={visits == null ? "No traffic yet" : fmt(visits)} />
          <MetricTile label="Leads · 30d" value={signups == null ? "No leads yet" : fmt(signups)} />
          <MetricTile label="Live listings" value={fmt(liveListings)} />
        </div>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">{published ? "Your site is live" : "Your site is in draft"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {published
              ? "Anyone with the link can join your buyers list. Next, share your link or add a property so there's a deal to show."
              : "Finish setup and publish to put your site online."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button asChild variant="brand">
              <Link href={`/websites/${site.id}/studio`}>Edit your site</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/websites/${site.id}/edit`}>Edit details</Link>
            </Button>
          </div>
        </Card>
      </div>
    </MainLayout>
  )
}
