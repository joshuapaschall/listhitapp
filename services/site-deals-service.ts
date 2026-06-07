import { supabaseAdmin } from "@/lib/supabase/admin"
import type { DealSummary } from "@/lib/site-builder/types"

// Server-only: public site reads are sessionless, so they MUST use supabaseAdmin
// (anon returns 0 rows under RLS). This lives in its own module — NOT in
// PropertyService — because PropertyService is imported by client components,
// and admin.ts throws in the browser (assertServer + service-role key).
// Org-scoped so each tenant site only ever shows its own deals.
export async function getPublishedDeals(orgId: string | null, limit = 6, offset = 0): Promise<DealSummary[]> {
  let query = supabaseAdmin
    .from("properties")
    .select("id,slug,address,city,state,price,bedrooms,bathrooms,sqft,property_type")
    .eq("status", "available")
    .not("slug", "is", null)
    .is("deleted_at", null)
  if (orgId) query = query.eq("org_id", orgId)

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw new Error(error.message)

  const rows = (data || []) as Array<Omit<DealSummary, "primary_image_url">>
  const ids = rows.map((r) => r.id)
  const imagesByProperty = new Map<string, { image_url: string; is_featured: boolean; sort_order: number }[]>()
  if (ids.length > 0) {
    const { data: imgs, error: imgErr } = await supabaseAdmin
      .from("property_images")
      .select("property_id,image_url,is_featured,sort_order")
      .in("property_id", ids)
      .order("sort_order", { ascending: true })
    if (imgErr) throw new Error(imgErr.message)
    for (const img of (imgs || []) as Array<{ property_id: string; image_url: string; is_featured: boolean; sort_order: number }>) {
      const list = imagesByProperty.get(img.property_id) || []
      list.push(img)
      imagesByProperty.set(img.property_id, list)
    }
  }

  return rows.map((r) => {
    const imgs = imagesByProperty.get(r.id) || []
    const primary = imgs.find((i) => i.is_featured) || imgs[0] || null
    return { ...r, primary_image_url: primary?.image_url || null }
  })
}
