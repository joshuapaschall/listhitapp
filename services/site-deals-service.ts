import { supabaseAdmin } from "@/lib/supabase/admin"
import type { DealSummary, DealDetail, DealImage } from "@/lib/site-builder/types"
import type { ParsedMarket } from "@/lib/site-builder/location-pages"

// Server-only: public site reads are sessionless, so they MUST use supabaseAdmin
// (anon returns 0 rows under RLS). This lives in its own module — NOT in
// PropertyService — because PropertyService is imported by client components,
// and admin.ts throws in the browser (assertServer + service-role key).
// Org-scoped so each tenant site only ever shows its own deals.

const DEAL_SUMMARY_COLUMNS = "id,slug,address,city,state,price,bedrooms,bathrooms,sqft,property_type"

interface PropertyImageRow {
  property_id: string
  image_url: string
  is_featured: boolean
  sort_order: number
}

// Shared image hydration: fetch all property_images for the given property ids,
// grouped per property and ordered featured-first then by sort_order.
async function fetchImagesByProperty(ids: string[]): Promise<Map<string, PropertyImageRow[]>> {
  const map = new Map<string, PropertyImageRow[]>()
  if (ids.length === 0) return map
  const { data: imgs, error } = await supabaseAdmin
    .from("property_images")
    .select("property_id,image_url,is_featured,sort_order")
    .in("property_id", ids)
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true })
  if (error) throw new Error(error.message)
  for (const img of (imgs || []) as PropertyImageRow[]) {
    const list = map.get(img.property_id) || []
    list.push(img)
    map.set(img.property_id, list)
  }
  return map
}

function primaryUrl(imgs: PropertyImageRow[] | undefined): string | null {
  if (!imgs || imgs.length === 0) return null
  const primary = imgs.find((i) => i.is_featured) || imgs[0]
  return primary?.image_url || null
}

export async function getPublishedDeals(orgId: string | null, limit = 6, offset = 0): Promise<DealSummary[]> {
  let query = supabaseAdmin
    .from("properties")
    .select(DEAL_SUMMARY_COLUMNS)
    .eq("status", "available")
    .eq("show_on_site", true)
    .not("slug", "is", null)
    .is("deleted_at", null)
  if (orgId) query = query.eq("org_id", orgId)

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw new Error(error.message)

  const rows = (data || []) as Array<Omit<DealSummary, "primary_image_url">>
  const imagesByProperty = await fetchImagesByProperty(rows.map((r) => r.id))
  return rows.map((r) => ({ ...r, primary_image_url: primaryUrl(imagesByProperty.get(r.id)) }))
}

export async function getPublishedDealCount(orgId: string | null): Promise<number> {
  let query = supabaseAdmin
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("status", "available")
    .eq("show_on_site", true)
    .not("slug", "is", null)
    .is("deleted_at", null)
  if (orgId) query = query.eq("org_id", orgId)
  const { count, error } = await query
  if (error) throw new Error(error.message)
  return count || 0
}

export async function getPublishedDealsForMarket(
  orgId: string | null,
  market: ParsedMarket,
  limit = 6,
): Promise<DealSummary[]> {
  let query = supabaseAdmin
    .from("properties")
    .select(DEAL_SUMMARY_COLUMNS)
    .eq("status", "available")
    .eq("show_on_site", true)
    .not("slug", "is", null)
    .is("deleted_at", null)
  if (orgId) query = query.eq("org_id", orgId)

  // City pages narrow to city + state; county/state pages scope to the state.
  if (market.kind === "city") {
    query = query.ilike("city", market.place).eq("state", market.stateId)
  } else {
    query = query.eq("state", market.stateId)
  }

  const { data, error } = await query.order("created_at", { ascending: false }).range(0, limit - 1)
  if (error) throw new Error(error.message)

  const rows = (data || []) as Array<Omit<DealSummary, "primary_image_url">>
  if (rows.length === 0) return getPublishedDeals(orgId, limit)

  const imagesByProperty = await fetchImagesByProperty(rows.map((r) => r.id))
  return rows.map((r) => ({ ...r, primary_image_url: primaryUrl(imagesByProperty.get(r.id)) }))
}

export async function getPublishedDealBySlug(orgId: string | null, slug: string): Promise<DealDetail | null> {
  let query = supabaseAdmin
    .from("properties")
    .select(
      "id,slug,address,city,state,zip,price,bedrooms,bathrooms,sqft,property_type,description,deal_type,finance_subtype,status,year_built,lot_size,mls_number,construction_type,photo_album_url,video_link",
    )
    .eq("slug", slug)
    .eq("status", "available")
    .eq("show_on_site", true)
    .is("deleted_at", null)
  if (orgId) query = query.eq("org_id", orgId)

  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null

  const row = data as Omit<DealDetail, "primary_image_url" | "images">
  const imagesByProperty = await fetchImagesByProperty([row.id])
  const imgs = imagesByProperty.get(row.id) || []
  const images: DealImage[] = imgs.map((i) => ({ image_url: i.image_url, is_featured: i.is_featured }))
  return { ...row, primary_image_url: primaryUrl(imgs), images }
}

export async function getNearbyPublishedDeals(
  orgId: string | null,
  city: string | null,
  state: string | null,
  excludeId: string,
  limit = 3,
): Promise<DealSummary[]> {
  // Run a base query with the standard active/published filters, optionally
  // scoped to a location, excluding the current property.
  function baseQuery() {
    let q = supabaseAdmin
      .from("properties")
      .select(DEAL_SUMMARY_COLUMNS)
      .eq("status", "available")
      .eq("show_on_site", true)
      .not("slug", "is", null)
      .is("deleted_at", null)
      .neq("id", excludeId)
    if (orgId) q = q.eq("org_id", orgId)
    return q
  }

  async function run(applyLocation: (q: ReturnType<typeof baseQuery>) => ReturnType<typeof baseQuery>) {
    const { data, error } = await applyLocation(baseQuery())
      .order("created_at", { ascending: false })
      .range(0, limit - 1)
    if (error) throw new Error(error.message)
    return (data || []) as Array<Omit<DealSummary, "primary_image_url">>
  }

  // Prefer same-city, then same-state, then latest org deals.
  let rows = city ? await run((q) => q.ilike("city", city)) : []
  if (rows.length < 1 && state) rows = await run((q) => q.eq("state", state))
  if (rows.length < 1) rows = await run((q) => q)

  const imagesByProperty = await fetchImagesByProperty(rows.map((r) => r.id))
  return rows.map((r) => ({ ...r, primary_image_url: primaryUrl(imagesByProperty.get(r.id)) }))
}
