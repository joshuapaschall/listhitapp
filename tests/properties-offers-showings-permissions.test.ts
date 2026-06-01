import { NextRequest } from "next/server"

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

const state = vi.hoisted(() => ({
  currentUser: { id: "user-1" } as { id: string } | null,
  callerRole: "user",
  permissions: [] as any[],
}))

function permissionRows() {
  return state.permissions.filter((permission) => permission.granted !== false)
}

function createPermissionQuery(rows: any[]) {
  const query = {
    eq: () => query,
    then: (resolve: any) => resolve({ data: rows, error: null }),
  }
  return query
}

function createRouteClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: state.currentUser }, error: null }),
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { role: state.callerRole }, error: null }),
            }),
          }),
        }
      }

      if (table === "permissions") {
        return {
          select: () => createPermissionQuery(permissionRows()),
        }
      }

      return createAdminQuery(table)
    },
  }
}

function createAdminQuery(table: string) {
  const row =
    table === "offers"
      ? { id: "offer-1", status: "submitted", buyer_id: "buyer-1", property_id: "property-1" }
      : table === "showings"
        ? { id: "showing-1", status: "scheduled", scheduled_at: "2026-06-01T12:00:00.000Z", buyer_id: "buyer-1", property_id: "property-1" }
        : table === "properties"
          ? { id: "property-1", address: "123 Main St" }
          : null

  const query: any = {
    select: () => query,
    insert: () => query,
    update: () => query,
    delete: () => query,
    eq: () => query,
    gte: () => query,
    lte: () => query,
    order: () => query,
    single: async () => ({ data: row ?? { id: "row-1" }, error: null }),
    maybeSingle: async () => ({ data: row, error: null }),
    then: (resolve: any) => {
      if (table === "property_images") return resolve({ data: [], error: null })
      return resolve({ data: row ? [row] : [], error: null })
    },
  }

  return query
}

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: () => createRouteClient(),
}))

vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: async () => ({
    user: state.currentUser,
    orgId: state.currentUser ? "org-1" : null,
    supabase: createRouteClient(),
  }),
}))

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => createAdminQuery(table),
    storage: {
      from: () => ({
        remove: async () => ({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "https://storage.test/property.jpg" } }),
        createSignedUploadUrl: async () => ({
          data: { path: "property-1/photo.jpg", token: "token", signedUrl: "https://storage.test/upload" },
          error: null,
        }),
      }),
    },
  },
}))

vi.mock("@/lib/offer-notifications", () => ({
  sendOfferStatusNotification: vi.fn(async () => undefined),
}))

vi.mock("@/lib/showing-notifications", () => ({
  sendShowingConfirmation: vi.fn(async () => undefined),
}))

vi.mock("@/lib/notifications", () => ({
  insertNotification: vi.fn(async () => undefined),
}))

type Permission =
  | "properties.view"
  | "properties.manage"
  | "offers.view"
  | "offers.manage"
  | "showings.view"
  | "showings.manage"

function grant(...permissions: Permission[]) {
  state.permissions = permissions.map((permission_key) => ({
    user_id: "user-1",
    permission_key,
    granted: true,
  }))
}

function jsonRequest(url: string, method: string, body: Record<string, unknown> = {}) {
  return new NextRequest(url, {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

function routeContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe("properties/offers/showings permission gates", () => {
  beforeEach(() => {
    vi.resetModules()
    state.currentUser = { id: "user-1" }
    state.callerRole = "user"
    state.permissions = []
  })

  describe("offers", () => {
    async function getOffers() {
      const { GET } = await import("../app/api/offers/route")
      return GET(new NextRequest("http://test/api/offers"))
    }

    async function postOffer() {
      const { POST } = await import("../app/api/offers/route")
      return POST(jsonRequest("http://test/api/offers", "POST", { buyer_id: "buyer-1", property_id: "property-1" }))
    }

    test("GET is denied without offers.view and allowed with view/admin", async () => {
      expect((await getOffers()).status).toBe(403)

      grant("offers.view")
      expect((await getOffers()).status).toBe(200)

      state.permissions = []
      state.callerRole = "admin"
      expect((await getOffers()).status).toBe(200)
    })

    test("POST is denied without offers.manage and allowed with manage/admin", async () => {
      grant("offers.view")
      expect((await postOffer()).status).toBe(403)

      grant("offers.manage")
      expect((await postOffer()).status).toBe(201)

      state.permissions = []
      state.callerRole = "admin"
      expect((await postOffer()).status).toBe(201)
    })
  })

  describe("showings", () => {
    async function getShowings() {
      const { GET } = await import("../app/api/showings/route")
      return GET(new NextRequest("http://test/api/showings"))
    }

    async function postShowing() {
      const { POST } = await import("../app/api/showings/route")
      return POST(jsonRequest("http://test/api/showings", "POST", { scheduled_at: "2026-06-01T12:00:00.000Z" }))
    }

    async function patchShowing() {
      const { PATCH } = await import("../app/api/showings/[id]/route")
      return PATCH(jsonRequest("http://test/api/showings/showing-1", "PATCH", { status: "completed" }), routeContext("showing-1"))
    }

    async function deleteShowing() {
      const { DELETE } = await import("../app/api/showings/[id]/route")
      return DELETE(new NextRequest("http://test/api/showings/showing-1", { method: "DELETE" }), routeContext("showing-1"))
    }

    test("GET is gated on showings.view", async () => {
      expect((await getShowings()).status).toBe(403)

      grant("showings.view")
      expect((await getShowings()).status).toBe(200)

      state.permissions = []
      state.callerRole = "admin"
      expect((await getShowings()).status).toBe(200)
    })

    test("POST/PATCH/DELETE are gated on showings.manage", async () => {
      grant("showings.view")
      expect((await postShowing()).status).toBe(403)
      expect((await patchShowing()).status).toBe(403)
      expect((await deleteShowing()).status).toBe(403)

      grant("showings.manage")
      expect((await postShowing()).status).toBe(201)
      expect((await patchShowing()).status).toBe(200)
      expect((await deleteShowing()).status).toBe(204)
    })
  })

  describe("properties", () => {
    async function postProperty() {
      const { POST } = await import("../app/api/properties/route")
      return POST(jsonRequest("http://test/api/properties", "POST", { address: "123 Main St", latitude: 35, longitude: -80 }))
    }

    async function patchProperty() {
      const { PATCH } = await import("../app/api/properties/[id]/route")
      return PATCH(jsonRequest("http://test/api/properties/property-1", "PATCH", { address: "123 Main St", latitude: 35, longitude: -80 }), routeContext("property-1"))
    }

    async function deleteProperty() {
      const { DELETE } = await import("../app/api/properties/[id]/route")
      return DELETE(new NextRequest("http://test/api/properties/property-1", { method: "DELETE" }), routeContext("property-1"))
    }

    test("POST/PATCH/DELETE are gated on properties.manage", async () => {
      grant("properties.view")
      expect((await postProperty()).status).toBe(403)
      expect((await patchProperty()).status).toBe(403)
      expect((await deleteProperty()).status).toBe(403)

      grant("properties.manage")
      expect((await postProperty()).status).toBe(201)
      expect((await patchProperty()).status).toBe(200)
      expect((await deleteProperty()).status).toBe(200)

      state.permissions = []
      state.callerRole = "admin"
      expect((await postProperty()).status).toBe(201)
      expect((await patchProperty()).status).toBe(200)
      expect((await deleteProperty()).status).toBe(200)
    })
  })

  test("viewer users can GET offers/showings but cannot write offers, showings, or properties", async () => {
    grant("properties.view", "offers.view", "showings.view")

    const { GET: getOffers, POST: postOffer } = await import("../app/api/offers/route")
    const { GET: getShowings, POST: postShowing } = await import("../app/api/showings/route")
    const { PATCH: patchShowing, DELETE: deleteShowing } = await import("../app/api/showings/[id]/route")
    const { POST: postProperty } = await import("../app/api/properties/route")
    const { PATCH: patchProperty, DELETE: deleteProperty } = await import("../app/api/properties/[id]/route")

    expect((await getOffers(new NextRequest("http://test/api/offers"))).status).toBe(200)
    expect((await getShowings(new NextRequest("http://test/api/showings"))).status).toBe(200)
    expect((await postOffer(jsonRequest("http://test/api/offers", "POST", { buyer_id: "buyer-1", property_id: "property-1" }))).status).toBe(403)
    expect((await postShowing(jsonRequest("http://test/api/showings", "POST", { scheduled_at: "2026-06-01T12:00:00.000Z" }))).status).toBe(403)
    expect((await patchShowing(jsonRequest("http://test/api/showings/showing-1", "PATCH", { status: "completed" }), routeContext("showing-1"))).status).toBe(403)
    expect((await deleteShowing(new NextRequest("http://test/api/showings/showing-1", { method: "DELETE" }), routeContext("showing-1"))).status).toBe(403)
    expect((await postProperty(jsonRequest("http://test/api/properties", "POST", { address: "123 Main St", latitude: 35, longitude: -80 }))).status).toBe(403)
    expect((await patchProperty(jsonRequest("http://test/api/properties/property-1", "PATCH", { address: "123 Main St", latitude: 35, longitude: -80 }), routeContext("property-1"))).status).toBe(403)
    expect((await deleteProperty(new NextRequest("http://test/api/properties/property-1", { method: "DELETE" }), routeContext("property-1"))).status).toBe(403)
  })
})
