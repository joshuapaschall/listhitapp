import { NextRequest } from "next/server"

const propertiesData = [
  {
    id: "p1",
    slug: "alpha-home",
    address: "123 Main St",
    city: "Atlanta",
    state: "GA",
    zip: "30303",
    latitude: 33.7,
    longitude: -84.4,
    price: 100000,
    down_payment: 10000,
    monthly_payment: 1000,
    earnest_money: 5000,
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1200,
    description: "A".repeat(300),
    property_type: "single_family",
    condition: "light_rehab",
    occupancy: "vacant",
    tags: ["hot"],
    status: "available",
    deleted_at: null,
    created_at: "2026-01-02T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
  },
  {
    id: "p2",
    slug: "beta-home",
    address: "456 Oak St",
    city: "Marietta",
    state: "GA",
    zip: "30060",
    latitude: null,
    longitude: null,
    price: 150000,
    down_payment: null,
    monthly_payment: null,
    earnest_money: null,
    bedrooms: 4,
    bathrooms: 3,
    sqft: 1800,
    description: "Short description",
    property_type: "townhome",
    condition: "turnkey",
    occupancy: "tenant",
    tags: ["new"],
    status: "available",
    deleted_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "p3",
    slug: "not-available",
    address: "789 Pine St",
    city: "Atlanta",
    state: "GA",
    zip: "30301",
    latitude: null,
    longitude: null,
    price: 99000,
    down_payment: null,
    monthly_payment: null,
    earnest_money: null,
    bedrooms: 2,
    bathrooms: 1,
    sqft: 900,
    description: "Unavailable",
    property_type: "single_family",
    condition: "heavy",
    occupancy: "vacant",
    tags: null,
    status: "sold",
    deleted_at: null,
    created_at: "2025-12-30T00:00:00.000Z",
    updated_at: "2025-12-30T00:00:00.000Z",
  },
]

const imagesData = [
  { id: "i1", property_id: "p1", image_url: "https://img/1.jpg", sort_order: 1, is_featured: false },
  { id: "i2", property_id: "p1", image_url: "https://img/2.jpg", sort_order: 0, is_featured: true },
  { id: "i3", property_id: "p2", image_url: "https://img/3.jpg", sort_order: 0, is_featured: false },
]

function applyFilters(rows: any[], state: any) {
  return rows.filter((row) => {
    if (state.eq.status && row.status !== state.eq.status) return false
    if (state.eq.property_type && row.property_type !== state.eq.property_type) return false
    if (state.eq.slug && row.slug !== state.eq.slug) return false
    if (state.notSlugNull && !row.slug) return false
    if (state.deletedAtNull && row.deleted_at !== null) return false
    if (state.gte.price !== undefined && (row.price ?? -Infinity) < state.gte.price) return false
    if (state.lte.price !== undefined && (row.price ?? Infinity) > state.lte.price) return false
    if (state.gte.bedrooms !== undefined && (row.bedrooms ?? -Infinity) < state.gte.bedrooms) return false
    if (state.ilike.city) {
      const needle = state.ilike.city.toLowerCase().replace(/%/g, "")
      if (!String(row.city || "").toLowerCase().includes(needle)) return false
    }
    return true
  })
}

function createPropertiesQuery(selectColumns: string, options?: any) {
  const state: any = { eq: {}, gte: {}, lte: {}, ilike: {}, notSlugNull: false, deletedAtNull: false, range: null as any, orderCreatedDesc: false }
  const q: any = {
    eq(col: string, val: any) { state.eq[col] = val; return q },
    gte(col: string, val: number) { state.gte[col] = val; return q },
    lte(col: string, val: number) { state.lte[col] = val; return q },
    ilike(col: string, val: string) { state.ilike[col] = val; return q },
    not(col: string, op: string, val: any) { if (col === "slug" && op === "is" && val === null) state.notSlugNull = true; return q },
    is(col: string, val: any) { if (col === "deleted_at" && val === null) state.deletedAtNull = true; return q },
    order(col: string, opts: any) { if (col === "created_at" && opts?.ascending === false) state.orderCreatedDesc = true; return q },
    range(start: number, end: number) { state.range = { start, end }; return q.exec() },
    maybeSingle() { return q.exec(true) },
    async exec(single = false) {
      const filtered = applyFilters(propertiesData, state)
      if (options?.head) return { count: filtered.length, error: null }
      let rows = [...filtered]
      if (state.orderCreatedDesc) rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      if (state.range) rows = rows.slice(state.range.start, state.range.end + 1)
      const cols = selectColumns.split(",")
      const mapped = rows.map((row) => Object.fromEntries(cols.map((col) => [col.trim(), row[col.trim()]])))
      if (single) return { data: mapped[0] || null, error: null }
      return { data: mapped, error: null }
    },
    then(resolve: any, reject: any) { return q.exec().then(resolve, reject) },
  }
  return q
}

function createPropertyImagesQuery() {
  const state: any = { inIds: null as string[] | null, eq: {}, orderSortAsc: false }
  const q: any = {
    in(col: string, vals: string[]) { if (col === "property_id") state.inIds = vals; return q },
    eq(col: string, val: any) { state.eq[col] = val; return q },
    order(col: string, opts: any) { if (col === "sort_order" && opts?.ascending === true) state.orderSortAsc = true; return q.exec() },
    async exec() {
      let rows = [...imagesData]
      if (state.inIds) rows = rows.filter((row) => state.inIds.includes(row.property_id))
      if (state.eq.property_id) rows = rows.filter((row) => row.property_id === state.eq.property_id)
      if (state.orderSortAsc) rows.sort((a, b) => a.sort_order - b.sort_order)
      return { data: rows, error: null }
    },
    then(resolve: any, reject: any) { return q.exec().then(resolve, reject) },
  }
  return q
}

// Sessionless site resolution (resolveSiteByHost) scopes public properties by
// org: site_domains maps the request host → site_id, then sites yields the org.
// The list route applies .eq("org_id", ...) and the detail route REQUIRES a
// resolved site (404 otherwise), so resolve a canned site here. applyFilters
// ignores org_id/show_on_site, so the list filtering assertions are unaffected.
function createSiteResolutionQuery(table: string) {
  const result =
    table === "site_domains"
      ? { data: { site_id: "s1" }, error: null }
      : { data: { id: "s1", org_id: "org1", status: "published" }, error: null }
  const q: any = { select: () => q, eq: () => q, maybeSingle: async () => result }
  return q
}

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "properties") return { select: (columns: string, options?: any) => createPropertiesQuery(columns, options) }
      if (table === "property_images") return { select: () => createPropertyImagesQuery() }
      if (table === "site_domains" || table === "sites") return createSiteResolutionQuery(table)
      throw new Error(`Unexpected table: ${table}`)
    },
  },
}))

const listRoute = await import("../app/api/public/properties/route")
const detailRoute = await import("../app/api/public/properties/[slug]/route")

const allowedOrigin = "https://georgiawholesalehomes.com"

describe("public properties api", () => {
  test("GET list with no filters returns all available properties with shape", async () => {
    const req = new NextRequest("http://localhost/api/public/properties", { headers: { origin: allowedOrigin } })
    const res = await listRoute.GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.count).toBe(2)
    expect(json.properties.length).toBe(2)
    expect(json.properties[0]).toHaveProperty("id")
    expect(json.properties[0]).toHaveProperty("primary_image_url")
    expect(json.properties[0]).toHaveProperty("image_count")
  })

  test("GET list respects limit and offset", async () => {
    const req = new NextRequest("http://localhost/api/public/properties?limit=1&offset=1", { headers: { origin: allowedOrigin } })
    const res = await listRoute.GET(req)
    const json = await res.json()
    expect(json.properties.length).toBe(1)
    expect(json.properties[0].id).toBe("p2")
  })

  test("GET list filters by min_price and max_price", async () => {
    const req = new NextRequest("http://localhost/api/public/properties?min_price=120000&max_price=160000", { headers: { origin: allowedOrigin } })
    const res = await listRoute.GET(req)
    const json = await res.json()
    expect(json.properties.length).toBe(1)
    expect(json.properties[0].id).toBe("p2")
  })

  test("GET list filters by property_type exact match", async () => {
    const req = new NextRequest("http://localhost/api/public/properties?property_type=single_family", { headers: { origin: allowedOrigin } })
    const res = await listRoute.GET(req)
    const json = await res.json()
    expect(json.properties.length).toBe(1)
    expect(json.properties[0].id).toBe("p1")
  })

  test("GET list filters by min_beds", async () => {
    const req = new NextRequest("http://localhost/api/public/properties?min_beds=4", { headers: { origin: allowedOrigin } })
    const res = await listRoute.GET(req)
    const json = await res.json()
    expect(json.properties.length).toBe(1)
    expect(json.properties[0].id).toBe("p2")
  })

  test("GET list filters by city partial case-insensitive", async () => {
    const req = new NextRequest("http://localhost/api/public/properties?city=ATL", { headers: { origin: allowedOrigin } })
    const res = await listRoute.GET(req)
    const json = await res.json()
    expect(json.properties.length).toBe(1)
    expect(json.properties[0].id).toBe("p1")
  })

  test("GET list excludes unavailable properties", async () => {
    const req = new NextRequest("http://localhost/api/public/properties", { headers: { origin: allowedOrigin } })
    const res = await listRoute.GET(req)
    const json = await res.json()
    const ids = json.properties.map((p: any) => p.id)
    expect(ids).not.toContain("p3")
  })

  test("GET list includes primary_image_url and image_count", async () => {
    const req = new NextRequest("http://localhost/api/public/properties", { headers: { origin: allowedOrigin } })
    const res = await listRoute.GET(req)
    const json = await res.json()
    expect(json.properties[0].primary_image_url).toBe("https://img/2.jpg")
    expect(json.properties[0].image_count).toBe(2)
  })

  test("GET detail by slug returns full property with images", async () => {
    const req = new NextRequest("http://localhost/api/public/properties/alpha-home", { headers: { origin: allowedOrigin } })
    const res = await detailRoute.GET(req, { params: Promise.resolve({ slug: "alpha-home" }) })
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.property.slug).toBe("alpha-home")
    expect(json.property.description.length).toBe(300)
    expect(json.property.images.length).toBe(2)
    expect(json.property.images[0].sort_order).toBe(0)
  })

  test("GET detail returns 404 for non-existent slug", async () => {
    const req = new NextRequest("http://localhost/api/public/properties/missing", { headers: { origin: allowedOrigin } })
    const res = await detailRoute.GET(req, { params: Promise.resolve({ slug: "missing" }) })
    expect(res.status).toBe(404)
  })

  test("GET detail returns 404 for slug of unavailable property", async () => {
    const req = new NextRequest("http://localhost/api/public/properties/not-available", { headers: { origin: allowedOrigin } })
    const res = await detailRoute.GET(req, { params: Promise.resolve({ slug: "not-available" }) })
    expect(res.status).toBe(404)
  })

  test("OPTIONS preflight returns 204 for allowed origin", async () => {
    const req = new NextRequest("http://localhost/api/public/properties", { method: "OPTIONS", headers: { origin: allowedOrigin } })
    const res = await listRoute.OPTIONS(req)
    expect(res.status).toBe(204)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(allowedOrigin)
  })

  test("OPTIONS preflight returns 403 for disallowed origin", async () => {
    const req = new NextRequest("http://localhost/api/public/properties", { method: "OPTIONS", headers: { origin: "https://evil.com" } })
    const res = await listRoute.OPTIONS(req)
    expect(res.status).toBe(403)
  })

  test("responses exclude internal-only fields", async () => {
    const listReq = new NextRequest("http://localhost/api/public/properties", { headers: { origin: allowedOrigin } })
    const listRes = await listRoute.GET(listReq)
    const listJson = await listRes.json()
    const detailReq = new NextRequest("http://localhost/api/public/properties/alpha-home", { headers: { origin: allowedOrigin } })
    const detailRes = await detailRoute.GET(detailReq, { params: Promise.resolve({ slug: "alpha-home" }) })
    const detailJson = await detailRes.json()

    for (const key of ["disposition_strategy", "buyer_fit", "priority", "short_url_key", "short_url", "short_slug", "shortio_link_id", "video_link", "website_url"]) {
      expect(listJson.properties[0][key]).toBeUndefined()
      expect(detailJson.property[key]).toBeUndefined()
    }
  })
})
