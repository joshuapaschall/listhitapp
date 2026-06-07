import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { resolveSite, mergeThemeIntoRoot } from "@/lib/site-builder/resolve-site"
import { SiteRenderer } from "@/components/sites/site-renderer"

// Public tenant sites read published rows from the DB at request time, so this
// route is never prerendered at build.
export const dynamic = "force-dynamic"

interface SitePageParams {
  host: string
  path?: string[]
}

function normalizePath(path?: string[]): string {
  const joined = "/" + (path?.join("/") ?? "")
  return joined.replace(/\/{2,}/g, "/")
}

export async function generateMetadata({
  params,
}: {
  params: SitePageParams
}): Promise<Metadata> {
  try {
    const host = decodeURIComponent(params.host)
    const path = normalizePath(params.path)
    const result = await resolveSite(host, path)
    if (!result) return { title: "Site not found" }
    return {
      title: result.page.title || result.site.name,
      description: result.page.meta_description || undefined,
    }
  } catch {
    return { title: "Site not found" }
  }
}

export default async function SitePage({ params }: { params: SitePageParams }) {
  const host = decodeURIComponent(params.host)
  const path = normalizePath(params.path)

  const result = await resolveSite(host, path)
  if (!result) notFound()

  const data = mergeThemeIntoRoot(result.page.puck_data, result.theme)

  return <SiteRenderer data={data} theme={result.theme} />
}
