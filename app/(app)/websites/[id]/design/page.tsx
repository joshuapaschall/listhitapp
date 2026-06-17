import MainLayout from "@/components/layout/main-layout"
import { loadOwnedSite } from "@/lib/websites/load-owned-site"
import { SiteHubNav } from "@/components/websites/site-hub-nav"
import { EditHub } from "@/components/websites/edit-hub"
import { ALL_SITE_TEMPLATES } from "@/lib/site-builder/templates"
import { DEFAULT_THEME } from "@/lib/site-builder/types"

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

// Home plus the legal/compliance pages required for A2P/10DLC — never toggleable.
const LOCKED_PATHS = new Set(["/", "/terms", "/privacy", "/contact"])

export default async function WebsiteDesignPage({ params }: { params: { id: string } }) {
  const { supabase, orgId, site } = await loadOwnedSite(
    params.id,
    "id,name,slug,status,persona,theme_json,template_id,thumbnail_url",
  )
  const templatesMeta = ALL_SITE_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    heroVariant: t.heroVariant,
    primary: (t.defaultTheme?.primary as string) || "#173b5e",
    accent: (t.defaultTheme?.accent as string) || "#e8833a",
  }))
  const published = site.status === "published"
  const theme = (site.theme_json || {}) as Record<string, any>
  const personaLabel = PERSONA_LABELS[site.persona] || site.persona || "—"
  const primary = (typeof theme.primary === "string" && theme.primary) || DEFAULT_THEME.primary
  const accent = (typeof theme.accent === "string" && theme.accent) || DEFAULT_THEME.accent

  // loadOwnedSite returns the org-scoped supabase client; fetch this site's pages
  // with it (no extra service/route needed) and shape them like the studio does.
  const { data: pageRows } = await supabase
    .from("site_pages")
    .select("path, nav_label, title, enabled, sort_order")
    .eq("site_id", site.id)
    .eq("org_id", orgId)
  const sorted = [...(pageRows || [])].sort((a: any, b: any) => {
    if (a.path === "/") return -1
    if (b.path === "/") return 1
    return (a.sort_order ?? 0) - (b.sort_order ?? 0)
  })
  const mappedPages = sorted.map((p: any) => ({
    path: p.path,
    label: p.path === "/" ? "Home" : p.nav_label || p.title || p.path,
    enabled: p.enabled !== false,
    locked: LOCKED_PATHS.has(p.path),
  }))

  return (
    <MainLayout>
      <div className="space-y-6 p-4 md:p-6">
        <SiteHubNav active="design" siteId={site.id} siteName={site.name} slug={site.slug} published={published} />

        <EditHub
          siteId={site.id}
          siteName={site.name}
          status={site.status}
          slug={site.slug}
          personaLabel={personaLabel}
          primary={primary}
          accent={accent}
          currentTemplateId={site.template_id}
          templates={templatesMeta}
          pages={mappedPages}
          thumbnailUrl={site.thumbnail_url ?? null}
        />
      </div>
    </MainLayout>
  )
}
