import type { SupabaseClient } from "@supabase/supabase-js"
import { DEFAULT_THEME, type SitePersona, type SiteTemplateId, type SiteTheme } from "@/lib/site-builder/types"
import { getSiteTemplate } from "@/lib/site-builder/templates"
import { slugifySiteName, isReservedSlug } from "@/lib/site-builder/slug"

// Backend data layer for the website builder.
//
// TENANT ISOLATION: every data read filters `.eq("org_id", orgId)` and every
// insert sets `org_id: orgId`. The sole exception is ensureUniqueSlug, which is
// a uniqueness probe against the schema's GLOBAL unique index on lower(slug) —
// it must be cross-org by design (a slug taken by another org would otherwise
// blow up the insert), and it selects only `id`, leaking no tenant content.
//
// Always called with the route's session `supabase` client — never the
// service-role admin client (the dashboard always has a session).

export interface CreateSiteInput {
  name: string
  persona: SitePersona
  templateId: SiteTemplateId
}

export interface BlockPatch {
  blockType: string
  props: Record<string, any>
}

const ROOT_DOMAIN = () => process.env.SITES_ROOT_DOMAIN || "listhit.io"

export class SiteService {
  // Resolve a globally-unique slug (matches the unique index on lower(slug)).
  // `excludeId` lets an update keep its own current slug without self-colliding.
  private static async ensureUniqueSlug(
    client: SupabaseClient,
    desired: string,
    excludeId?: string,
  ): Promise<string> {
    let base = slugifySiteName(desired) || "site"
    if (isReservedSlug(base)) base = `${base}-site`
    let candidate = base
    let n = 1
    // eslint-disable-next-line no-constant-condition
    while (true) {
      let query = client.from("sites").select("id").eq("slug", candidate)
      if (excludeId) query = query.neq("id", excludeId)
      const { data, error } = await query.maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) return candidate
      n += 1
      candidate = `${base}-${n}`
    }
  }

  static async list(client: SupabaseClient, orgId: string) {
    const { data, error } = await client
      .from("sites")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
    if (error) throw new Error(error.message)
    return data || []
  }

  static async get(client: SupabaseClient, orgId: string, siteId: string) {
    const { data: site, error } = await client
      .from("sites")
      .select("*")
      .eq("id", siteId)
      .eq("org_id", orgId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!site) return null

    const { data: pages, error: pagesError } = await client
      .from("site_pages")
      .select("*")
      .eq("site_id", siteId)
      .eq("org_id", orgId)
      .order("path", { ascending: true })
    if (pagesError) throw new Error(pagesError.message)

    return { site, pages: pages || [] }
  }

  static async create(client: SupabaseClient, orgId: string, input: CreateSiteInput) {
    const tpl = getSiteTemplate(input.templateId)
    if (!tpl) throw new Error(`Unknown template: ${input.templateId}`)

    const slug = await this.ensureUniqueSlug(client, input.name)
    const theme: SiteTheme = { ...DEFAULT_THEME, ...(tpl.defaultTheme || {}) }

    const { data: site, error } = await client
      .from("sites")
      .insert({
        org_id: orgId,
        name: input.name,
        slug,
        persona: input.persona,
        template_id: input.templateId,
        theme_json: theme,
        status: "draft",
      })
      .select("*")
      .single()
    if (error) throw new Error(error.message)

    const { error: pageError } = await client.from("site_pages").insert({
      site_id: site.id,
      org_id: orgId,
      path: "/",
      title: input.name,
      meta_description: null,
      puck_data: tpl.build(input.persona),
    })
    if (pageError) throw new Error(pageError.message)

    return site
  }

  static async updateMeta(
    client: SupabaseClient,
    orgId: string,
    siteId: string,
    patch: { name?: string; slug?: string },
  ) {
    const update: Record<string, any> = {}
    if (patch.name !== undefined) update.name = patch.name
    if (patch.slug !== undefined) update.slug = await this.ensureUniqueSlug(client, patch.slug, siteId)
    if (Object.keys(update).length === 0) return

    const { error } = await client
      .from("sites")
      .update(update)
      .eq("id", siteId)
      .eq("org_id", orgId)
    if (error) throw new Error(error.message)
  }

  static async updateTheme(
    client: SupabaseClient,
    orgId: string,
    siteId: string,
    themePatch: Partial<SiteTheme>,
  ) {
    const { data: site, error } = await client
      .from("sites")
      .select("theme_json")
      .eq("id", siteId)
      .eq("org_id", orgId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!site) throw new Error("Site not found")

    const merged = { ...((site.theme_json as Partial<SiteTheme>) || {}), ...themePatch }
    const { error: updateError } = await client
      .from("sites")
      .update({ theme_json: merged })
      .eq("id", siteId)
      .eq("org_id", orgId)
    if (updateError) throw new Error(updateError.message)
  }

  static async patchPageBlocks(
    client: SupabaseClient,
    orgId: string,
    siteId: string,
    patches: BlockPatch[],
    path = "/",
  ) {
    const { data: page, error } = await client
      .from("site_pages")
      .select("*")
      .eq("site_id", siteId)
      .eq("org_id", orgId)
      .eq("path", path)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!page) throw new Error("Page not found")

    const puck = JSON.parse(JSON.stringify(page.puck_data || {}))
    const content: any[] = Array.isArray(puck.content) ? puck.content : []
    for (const patch of patches) {
      const item = content.find((c) => c?.type === patch.blockType)
      if (item) item.props = { ...(item.props || {}), ...patch.props }
    }
    puck.content = content

    const { error: updateError } = await client
      .from("site_pages")
      .update({ puck_data: puck })
      .eq("id", page.id)
      .eq("org_id", orgId)
    if (updateError) throw new Error(updateError.message)
  }

  static async publish(client: SupabaseClient, orgId: string, siteId: string) {
    const { data: site, error } = await client
      .from("sites")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", siteId)
      .eq("org_id", orgId)
      .select("*")
      .single()
    if (error) throw new Error(error.message)

    const domain = `${site.slug}.${ROOT_DOMAIN()}`
    const { data: subdomain, error: domainError } = await client
      .from("site_domains")
      .upsert(
        { site_id: siteId, org_id: orgId, domain, type: "subdomain", status: "active" },
        { onConflict: "domain" },
      )
      .select("*")
      .single()
    if (domainError) throw new Error(domainError.message)

    return { site, subdomain }
  }

  static async unpublish(client: SupabaseClient, orgId: string, siteId: string) {
    const { data: site, error } = await client
      .from("sites")
      .update({ status: "draft" })
      .eq("id", siteId)
      .eq("org_id", orgId)
      .select("*")
      .single()
    if (error) throw new Error(error.message)
    return site
  }
}
