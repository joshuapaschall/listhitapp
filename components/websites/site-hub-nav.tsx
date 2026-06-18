import Link from "next/link"
import { ExternalLink, Globe } from "lucide-react"
import { cn } from "@/lib/utils"

type TabKey = "overview" | "posts" | "design" | "analytics" | "settings"

interface SiteHubNavProps {
  siteId: string
  siteName: string
  slug: string
  published: boolean
  active: TabKey
  publicUrl?: string | null
}

const TABS: { key: TabKey; label: string; href: (id: string) => string }[] = [
  { key: "overview", label: "Overview", href: (id) => `/websites/${id}` },
  { key: "posts", label: "Posts", href: (id) => `/websites/${id}/posts` },
  { key: "design", label: "Edit", href: (id) => `/websites/${id}/studio` },
  { key: "analytics", label: "Analytics", href: (id) => `/websites/${id}/analytics` },
  { key: "settings", label: "Settings", href: (id) => `/websites/${id}/settings` },
]

export function SiteHubNav({ siteId, siteName, slug, published, active, publicUrl }: SiteHubNavProps) {
  const publicHost = publicUrl ? publicUrl.replace(/^https?:\/\//, "") : slug
  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/websites" className="text-xs text-muted-foreground hover:text-foreground">
          Websites
        </Link>
        <span className="text-xs text-muted-foreground">/</span>
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand/10 text-brand">
            <Globe className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight">{siteName}</h1>
            <p className="truncate font-mono text-xs text-muted-foreground">{publicHost}</p>
          </div>
        </div>
        {published && publicUrl && (
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
          >
            View site <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* Tab bar */}
      <nav className="flex flex-wrap items-center gap-1 border-b border-border">
        {TABS.map((t) => {
          const isActive = t.key === active
          return (
            <Link
              key={t.key}
              href={t.href(siteId)}
              className={cn(
                "border-b-2 px-3 py-2 text-sm font-medium transition-colors -mb-px",
                isActive
                  ? "border-brand text-brand"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
