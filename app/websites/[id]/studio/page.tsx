import { notFound } from "next/navigation"
import { requireOrgContext } from "@/lib/auth/org-context"
import { SiteService } from "@/services/site-service"
import { DEFAULT_THEME } from "@/lib/site-builder/types"
import { mergeThemeIntoRoot } from "@/lib/site-builder/resolve-site"
import { SiteStudioEditor } from "@/components/websites/site-studio-editor"

export const dynamic = "force-dynamic"

export default async function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { orgId, supabase } = await requireOrgContext()
  if (!orgId) notFound()
  const result = await SiteService.get(supabase, orgId, id)
  if (!result) notFound()
  const { site, pages } = result
  const home = (pages || []).find((p: any) => p.path === "/")
  if (!home) notFound()
  const theme = { ...DEFAULT_THEME, ...(site.theme_json || {}) }
  const data = mergeThemeIntoRoot(home.puck_data, theme)
  return (
    <SiteStudioEditor
      siteId={site.id}
      slug={site.slug || ""}
      siteName={site.name || ""}
      status={site.status || "draft"}
      initialData={data}
    />
  )
}
