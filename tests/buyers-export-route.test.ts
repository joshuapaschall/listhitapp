import { NextRequest } from "next/server"
import { POST } from "../app/api/buyers/export/route"

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

const state = vi.hoisted(() => ({
  currentUser: { id: "user-1" } as { id: string } | null,
  callerRole: "user",
  permissions: [] as any[],
  buyers: [
    {
      id: "buyer-1",
      fname: "Allowed",
      lname: "Buyer",
      email: "allowed@example.com",
      sendfox_hidden: false,
      deleted_at: null,
      vip: true,
      score: 95,
      tags: ["cash"],
      locations: ["Dallas"],
      property_type: ["single family"],
      buyer_groups: [{ group_id: "group-1" }],
    },
    {
      id: "buyer-2",
      fname: "Hidden",
      email: "hidden@example.com",
      sendfox_hidden: true,
      deleted_at: "2024-01-01",
      vip: false,
      score: 10,
      tags: [],
      locations: [],
      property_type: [],
      buyer_groups: [{ group_id: "group-1" }],
    },
  ] as any[],
}))

function createBuyerQuery() {
  const filters = {
    groupId: "",
    ids: null as string[] | null,
    deletedAtNull: false,
    vip: undefined as boolean | undefined,
    minScore: undefined as number | undefined,
    selectedTags: [] as string[],
  }

  const query = {
    select: () => query,
    eq: (column: string, value: any) => {
      if (column === "buyer_groups.group_id") filters.groupId = value
      if (column === "vip") filters.vip = value
      return query
    },
    is: (column: string, value: any) => {
      if (column === "deleted_at" && value === null) filters.deletedAtNull = true
      return query
    },
    gte: (column: string, value: number) => {
      if (column === "score") filters.minScore = value
      return query
    },
    lte: () => query,
    contains: (column: string, value: string[]) => {
      if (column === "tags") filters.selectedTags = value
      return query
    },
    overlaps: () => query,
    not: () => query,
    or: () => query,
    in: (column: string, value: string[]) => {
      if (column === "id") filters.ids = value
      return query
    },
    then: (resolve: any) => {
      const data = state.buyers.filter((buyer) => {
        if (filters.deletedAtNull && buyer.deleted_at !== null) return false
        if (filters.vip !== undefined && buyer.vip !== filters.vip) return false
        if (filters.minScore !== undefined && buyer.score < filters.minScore) return false
        if (filters.groupId && !buyer.buyer_groups?.some((group: any) => group.group_id === filters.groupId)) return false
        if (filters.ids && !filters.ids.includes(buyer.id)) return false
        if (filters.selectedTags.some((tag) => !buyer.tags?.includes(tag))) return false
        return true
      })
      return resolve({ data, error: null })
    },
  }

  return query
}

function createPermissionClient() {
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
        const query = {
          eq: () => query,
          then: (resolve: any) => resolve({ data: state.permissions, error: null }),
        }
        return {
          select: () => query,
        }
      }

      if (table === "buyers") return createBuyerQuery()

      throw new Error(`Unexpected table ${table}`)
    },
  }
}

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: () => createPermissionClient(),
}))

describe("buyers export route permission gate", () => {
  beforeEach(() => {
    state.currentUser = { id: "user-1" }
    state.callerRole = "user"
    state.permissions = []
  })

  test("rejects non-permitted users with missing buyers.export permission", async () => {
    const req = new NextRequest("http://test/api/buyers/export", {
      method: "POST",
      body: JSON.stringify({ filters: {}, quickFilters: [] }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.missingPermission).toBe("buyers.export")
  })

  test("allows admins to export matching buyers", async () => {
    state.callerRole = "admin"
    const req = new NextRequest("http://test/api/buyers/export", {
      method: "POST",
      body: JSON.stringify({
        filters: { vip: "vip", selectedTags: ["cash"] },
        quickFilters: ["highScore"],
        groupId: "group-1",
      }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.buyers).toEqual([
      expect.objectContaining({ id: "buyer-1", email: "allowed@example.com" }),
    ])
    expect(body.buyers[0].buyer_groups).toBeUndefined()
  })

  test("allows users granted buyers.export", async () => {
    state.permissions = [{ user_id: "user-1", permission_key: "buyers.export", granted: true }]
    const req = new NextRequest("http://test/api/buyers/export", {
      method: "POST",
      body: JSON.stringify({ filters: {}, quickFilters: [], buyerIds: ["buyer-1"] }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.buyers).toEqual([
      expect.objectContaining({ id: "buyer-1" }),
    ])
  })
})
