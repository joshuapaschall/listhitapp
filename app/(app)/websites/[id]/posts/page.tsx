import Link from "next/link"
import { Plus } from "lucide-react"
import MainLayout from "@/components/layout/main-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { loadOwnedSite } from "@/lib/websites/load-owned-site"
import { SiteHubNav } from "@/components/websites/site-hub-nav"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

interface PostRow {
  id: string
  title: string
  slug: string
  status: string
  category: string | null
  seo_score: number | null
  featured_image_url: string | null
  updated_at: string | null
  published_at: string | null
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—"
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return "—"
  const diff = Date.now() - then
  const mins = Math.round(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function seoChip(score: number | null) {
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>
  const tone =
    score >= 80
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400"
      : score >= 50
        ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400"
        : "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400"
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", tone)}>{score}</span>
}

export default async function WebsitePostsPage({ params }: { params: { id: string } }) {
  const { supabase, orgId, site, publicUrl } = await loadOwnedSite(params.id, "id,name,slug,status")
  const published = site.status === "published"

  const { data } = await supabase
    .from("posts")
    .select("id,title,slug,status,category,seo_score,featured_image_url,updated_at,published_at")
    .eq("site_id", params.id)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
  const posts = (data || []) as PostRow[]

  return (
    <MainLayout>
      <div className="space-y-6 p-4 md:p-6">
        <SiteHubNav active="posts" siteId={site.id} siteName={site.name} slug={site.slug} published={published} publicUrl={publicUrl} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Posts</h2>
            <p className="text-sm text-muted-foreground">
              {posts.length} {posts.length === 1 ? "post" : "posts"}
            </p>
          </div>
          <Button asChild variant="brand">
            <Link href={`/websites/${site.id}/posts/new`}>
              <Plus className="h-4 w-4" /> New post
            </Link>
          </Button>
        </div>

        {posts.length === 0 ? (
          <Card className="mx-auto max-w-xl border-dashed bg-muted/30">
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <h3 className="text-lg font-semibold">No posts yet</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                Write your first article — published posts appear on your site&apos;s /blog.
              </p>
              <Button asChild variant="brand">
                <Link href={`/websites/${site.id}/posts/new`}>
                  <Plus className="h-4 w-4" /> New post
                </Link>
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="divide-y divide-border">
            {posts.map((p) => (
              <Link
                key={p.id}
                href={`/websites/${site.id}/posts/${p.id}`}
                className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <div className="h-12 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                  {p.featured_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.featured_image_url} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{p.title || "Untitled"}</div>
                  <div className="truncate font-mono text-xs text-muted-foreground">
                    /blog/{p.slug}
                    {p.category ? <span className="font-sans"> · {p.category}</span> : null}
                  </div>
                </div>
                <Badge variant={p.status === "published" ? "default" : "secondary"} className="shrink-0">
                  {p.status === "published" ? "Live" : "Draft"}
                </Badge>
                <div className="hidden w-10 shrink-0 text-center sm:block">{seoChip(p.seo_score)}</div>
                <div className="hidden w-20 shrink-0 text-right text-xs text-muted-foreground sm:block">
                  {relativeTime(p.updated_at)}
                </div>
              </Link>
            ))}
          </Card>
        )}
      </div>
    </MainLayout>
  )
}
