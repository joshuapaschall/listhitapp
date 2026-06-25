"use client"

function truncate(input: string, max: number): string {
  const s = (input || "").trim()
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + "…"
}

// Dashboard-only Google result preview. Uses shadcn theme tokens (not tenant
// brand tokens) since this is editor chrome, never rendered on a public site.
export function SerpPreview({
  host,
  slug,
  title,
  metaTitle,
  metaDescription,
  excerpt,
}: {
  host: string
  slug: string
  title: string
  metaTitle: string
  metaDescription: string
  excerpt: string
}) {
  const displayTitle = truncate(metaTitle || title || "Untitled post", 60)
  const displayDesc = truncate(metaDescription || excerpt || "", 155)
  const cleanHost = (host || "").replace(/^https?:\/\//, "").replace(/\/$/, "")

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Google preview
      </div>
      <div className="space-y-0.5">
        <div className="truncate text-xs text-emerald-700 dark:text-emerald-500">
          {cleanHost} › blog{slug ? ` › ${slug}` : ""}
        </div>
        <div className="truncate text-base font-medium text-blue-700 dark:text-blue-400">
          {displayTitle}
        </div>
        <p className="text-xs leading-snug text-muted-foreground">
          {displayDesc || "Add a meta description or excerpt to control this snippet."}
        </p>
      </div>
    </div>
  )
}
