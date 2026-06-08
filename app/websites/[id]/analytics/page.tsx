import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import MainLayout from "@/components/layout/main-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { resolveOrgIdForUser } from "@/lib/auth/org-context"
import { cn } from "@/lib/utils"
import { AnalyticsTrendChart, type TrendPoint } from "@/components/websites/analytics-trend-chart"
import { SiteHubNav } from "@/components/websites/site-hub-nav"

export const dynamic = "force-dynamic"

type RangeKey = "today" | "7d" | "30d" | "90d" | "12m" | "all"

const RANGES: { key: RangeKey; label: string; short: string }[] = [
  { key: "today", label: "Today", short: "Today" },
  { key: "7d", label: "Last 7 days", short: "7d" },
  { key: "30d", label: "Last 30 days", short: "30d" },
  { key: "90d", label: "Last 90 days", short: "90d" },
  { key: "12m", label: "Last 12 months", short: "12 months" },
  { key: "all", label: "All time", short: "All time" },
]

function resolveRange(raw: string | undefined): RangeKey {
  const allowed = RANGES.map((r) => r.key)
  return (allowed as string[]).includes(raw || "") ? (raw as RangeKey) : "30d"
}

const DAY_MS = 86_400_000

function computeWindow(range: RangeKey): { from: Date; to: Date; bucket: "day" | "week" | "month" } {
  const to = new Date()
  if (range === "today") {
    const from = new Date(to)
    from.setHours(0, 0, 0, 0)
    return { from, to, bucket: "day" }
  }
  if (range === "7d") return { from: new Date(to.getTime() - 7 * DAY_MS), to, bucket: "day" }
  if (range === "90d") return { from: new Date(to.getTime() - 90 * DAY_MS), to, bucket: "day" }
  if (range === "12m") return { from: new Date(to.getTime() - 365 * DAY_MS), to, bucket: "week" }
  if (range === "all") return { from: new Date("1970-01-01T00:00:00.000Z"), to, bucket: "month" }
  return { from: new Date(to.getTime() - 30 * DAY_MS), to, bucket: "day" }
}

function formatBucketLabel(iso: string, bucket: "day" | "week" | "month"): string {
  const d = new Date(iso)
  if (bucket === "month") return d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0
  return Math.round((numerator / denominator) * 1000) / 10
}

export default async function WebsiteAnalyticsPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { range?: string }
}) {
  const cookieStore = cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const orgId = await resolveOrgIdForUser(user.id)
  if (!orgId) redirect("/login")

  // Org-scoped load confirms ownership before showing any analytics.
  const { data: site } = await supabase
    .from("sites")
    .select("id,name,slug,status")
    .eq("id", params.id)
    .eq("org_id", orgId)
    .maybeSingle()
  if (!site) notFound()

  const range = resolveRange(searchParams?.range)
  const rangeLabel = RANGES.find((r) => r.key === range)?.label || "Last 30 days"
  const { from, to, bucket } = computeWindow(range)
  const fromIso = from.toISOString()
  const toIso = to.toISOString()

  // RLS + auth_org_id() scope these RPCs to the caller's org automatically.
  const [summaryRes, seriesRes, sourcesRes, pagesRes] = await Promise.all([
    supabase.rpc("site_analytics_summary", { p_site_id: site.id, p_from: fromIso, p_to: toIso }),
    supabase.rpc("site_analytics_timeseries", { p_site_id: site.id, p_from: fromIso, p_to: toIso, p_bucket: bucket }),
    supabase.rpc("site_analytics_top_sources", { p_site_id: site.id, p_from: fromIso, p_to: toIso }),
    supabase.rpc("site_analytics_top_pages", { p_site_id: site.id, p_from: fromIso, p_to: toIso }),
  ])

  const summaryRow = (summaryRes.data?.[0] || {}) as { visits?: number; uniques?: number; signups?: number }
  const visits = Number(summaryRow.visits || 0)
  const uniques = Number(summaryRow.uniques || 0)
  const signups = Number(summaryRow.signups || 0)
  const conversionRate = pct(signups, uniques)

  const series: TrendPoint[] = ((seriesRes.data || []) as Array<{ bucket: string; visits: number; signups: number }>).map(
    (r) => ({ label: formatBucketLabel(r.bucket, bucket), visits: Number(r.visits || 0), signups: Number(r.signups || 0) }),
  )

  const sources = ((sourcesRes.data || []) as Array<{ source: string; visits: number; signups: number }>).map((r) => ({
    source: r.source || "Direct",
    visits: Number(r.visits || 0),
    signups: Number(r.signups || 0),
  }))
  const maxSourceVisits = Math.max(1, ...sources.map((s) => s.visits))

  const pages = ((pagesRes.data || []) as Array<{ path: string; visits: number; signups: number }>).map((r) => ({
    path: r.path || "/",
    visits: Number(r.visits || 0),
    signups: Number(r.signups || 0),
  }))

  const funnel = [
    { label: "Visits", value: visits, sub: "total pageviews", accent: false },
    { label: "Unique visitors", value: uniques, sub: "distinct visitors", accent: false },
    { label: "Signups", value: signups, sub: "leads captured", accent: false },
    { label: "Conversion rate", value: `${conversionRate}%`, sub: "signups ÷ unique visitors", accent: true },
  ]
  const funnelShare = [visits, uniques, signups]

  const hasData = visits > 0

  return (
    <MainLayout>
      <div className="space-y-6 p-4 md:p-6">
        <SiteHubNav
          active="analytics"
          siteId={site.id}
          siteName={site.name}
          slug={site.slug}
          published={site.status === "published"}
        />

        {/* Range selector */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{rangeLabel}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {RANGES.map((r) => {
              const active = r.key === range
              return (
                <Link
                  key={r.key}
                  href={`/websites/${site.id}/analytics?range=${r.key}`}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-brand text-brand-fg"
                      : "border border-border text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  {r.short}
                </Link>
              )
            })}
          </div>
        </div>

        {!hasData ? (
          <Card className="mx-auto max-w-xl border-dashed bg-muted/30">
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <h2 className="text-lg font-semibold">Analytics will appear here once your site gets traffic</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                Publish your site and share the link — visits, unique visitors, and signups will show up here as people
                arrive.
              </p>
              <Button asChild variant="brand">
                <Link href={`/websites/${site.id}/edit`}>Open website</Link>
              </Button>
            </div>
          </Card>
        ) : (
          <>
            {/* Funnel */}
            <Card className="p-5">
              <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
                {funnel.map((m, i) => {
                  const share = i < 3 && visits > 0 ? Math.round((funnelShare[i] / visits) * 100) : null
                  return (
                    <div key={m.label}>
                      <div className="text-xs font-medium text-muted-foreground">{m.label}</div>
                      <div
                        className={cn(
                          "mt-2 text-[28px] font-[650] leading-none tracking-tight tabular-nums",
                          m.accent ? "text-brand" : "text-foreground",
                        )}
                      >
                        {typeof m.value === "number" ? m.value.toLocaleString() : m.value}
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{ width: `${m.accent ? Math.min(conversionRate, 100) : share ?? 0}%` }}
                        />
                      </div>
                      <div className="mt-2 text-[11px] text-muted-foreground/70">{m.sub}</div>
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* Trend */}
            <Card className="p-5">
              <h2 className="mb-1 text-sm font-semibold">Visits vs. signups</h2>
              <p className="mb-3 text-xs text-muted-foreground">How traffic and conversions move over time.</p>
              <AnalyticsTrendChart data={series} />
            </Card>

            {/* Panels */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <h2 className="mb-4 text-sm font-semibold">Where visitors come from</h2>
                {sources.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No traffic sources yet.</p>
                ) : (
                  <div className="space-y-3">
                    {sources.map((s) => (
                      <div key={s.source}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-foreground">{s.source}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {s.visits.toLocaleString()} · {pct(s.signups, s.visits)}%
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{ width: `${Math.round((s.visits / maxSourceVisits) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-5">
                <h2 className="mb-4 text-sm font-semibold">Pages that convert best</h2>
                {pages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No page data yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      <span>Page</span>
                      <span>Signups · Conv.</span>
                    </div>
                    {pages.map((p) => (
                      <div key={p.path} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-mono text-xs text-foreground">{p.path}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {p.signups.toLocaleString()} · {pct(p.signups, p.visits)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  )
}
