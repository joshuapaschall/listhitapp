import { NextRequest } from "next/server"

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

const state = vi.hoisted(() => ({
  currentUser: { id: "user-1" } as { id: string } | null,
  callerRole: "user",
  permissions: [] as any[],
  insertedBuyers: [] as any[],
  updatedBuyers: [] as { id: string; data: any }[],
  nextInsertId: 1,
}))

function createBuyerRow(payload: any) {
  const id = payload.id || `buyer-${state.nextInsertId++}`
  return { id, ...payload }
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

      if (table === "buyers") {
        return {
          insert: (payload: any[]) => {
            const rows = payload.map(createBuyerRow)
            const query = {
              select: (_columns?: string) => {
                const selectedRows = rows.map((row) => ({ id: row.id, ...row }))
                return {
                  single: async () => {
                    state.insertedBuyers.push(...rows)
                    return { data: selectedRows[0], error: null }
                  },
                  then: (resolve: any) => {
                    state.insertedBuyers.push(...rows)
                    return resolve({ data: selectedRows, error: null })
                  },
                }
              },
            }
            return query
          },
          update: (data: any) => ({
            eq: (_column: string, id: string) => ({
              select: (_columns?: string) => ({
                single: async () => {
                  state.updatedBuyers.push({ id, data })
                  return { data: { id, ...data }, error: null }
                },
              }),
            }),
          }),
        }
      }

      throw new Error(`Unexpected route client table ${table}`)
    },
  }
}

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: () => createPermissionClient(),
}))

describe("buyers write permission gates", () => {
  beforeEach(() => {
    vi.resetModules()
    state.currentUser = { id: "user-1" }
    state.callerRole = "user"
    state.permissions = []
    state.insertedBuyers = []
    state.updatedBuyers = []
    state.nextInsertId = 1
  })

  describe("POST /api/buyers", () => {
    async function postBuyer() {
      const { POST } = await import("../app/api/buyers/route")
      const req = new NextRequest("http://test/api/buyers", {
        method: "POST",
        body: JSON.stringify({ fname: "Jane", email: "jane@example.com" }),
      })
      return POST(req)
    }

    test("rejects users without buyers.edit", async () => {
      const res = await postBuyer()

      expect(res.status).toBe(403)
      expect(state.insertedBuyers).toEqual([])
    })

    test("allows admins to create buyers", async () => {
      state.callerRole = "admin"

      const res = await postBuyer()
      const body = await res.json()

      expect(res.status).toBe(201)
      expect(body.buyer.id).toBe("buyer-1")
      expect(state.insertedBuyers).toEqual([{ id: "buyer-1", fname: "Jane", email: "jane@example.com" }])
    })

    test("allows users granted buyers.edit to create buyers", async () => {
      state.permissions = [{ user_id: "user-1", permission_key: "buyers.edit", granted: true }]

      const res = await postBuyer()

      expect(res.status).toBe(201)
      expect(state.insertedBuyers).toHaveLength(1)
    })
  })

  describe("PATCH /api/buyers/[id]", () => {
    async function patchBuyer() {
      const { PATCH } = await import("../app/api/buyers/[id]/route")
      const req = new NextRequest("http://test/api/buyers/buyer-1", {
        method: "PATCH",
        body: JSON.stringify({ fname: "Updated" }),
      })
      return PATCH(req, { params: { id: "buyer-1" } })
    }

    test("rejects users without buyers.edit", async () => {
      const res = await patchBuyer()

      expect(res.status).toBe(403)
      expect(state.updatedBuyers).toEqual([])
    })

    test("allows admins to update buyers", async () => {
      state.callerRole = "admin"

      const res = await patchBuyer()

      expect(res.status).toBe(200)
      expect(state.updatedBuyers).toEqual([{ id: "buyer-1", data: { fname: "Updated" } }])
    })

    test("allows users granted buyers.edit to update buyers", async () => {
      state.permissions = [{ user_id: "user-1", permission_key: "buyers.edit", granted: true }]

      const res = await patchBuyer()

      expect(res.status).toBe(200)
      expect(state.updatedBuyers).toEqual([{ id: "buyer-1", data: { fname: "Updated" } }])
    })
  })

  describe("PATCH /api/buyers/[id]/tags", () => {
    async function patchTags() {
      const { PATCH } = await import("../app/api/buyers/[id]/tags/route")
      const req = new NextRequest("http://test/api/buyers/buyer-1/tags", {
        method: "PATCH",
        body: JSON.stringify({ tags: ["vip", "cash"] }),
      })
      return PATCH(req, { params: { id: "buyer-1" } })
    }

    test("rejects users without buyers.edit", async () => {
      const res = await patchTags()

      expect(res.status).toBe(403)
      expect(state.updatedBuyers).toEqual([])
    })

    test("allows admins to update buyer tags", async () => {
      state.callerRole = "admin"

      const res = await patchTags()

      expect(res.status).toBe(200)
      expect(state.updatedBuyers).toEqual([{ id: "buyer-1", data: { tags: ["vip", "cash"] } }])
    })

    test("allows users granted buyers.edit to update buyer tags", async () => {
      state.permissions = [{ user_id: "user-1", permission_key: "buyers.edit", granted: true }]

      const res = await patchTags()

      expect(res.status).toBe(200)
      expect(state.updatedBuyers).toEqual([{ id: "buyer-1", data: { tags: ["vip", "cash"] } }])
    })
  })

  describe("POST /api/buyers/import", () => {
    async function importBuyers() {
      const { POST } = await import("../app/api/buyers/import/route")
      const req = new NextRequest("http://test/api/buyers/import", {
        method: "POST",
        body: JSON.stringify({ buyers: [{ fname: "Imported" }] }),
      })
      return POST(req)
    }

    test("rejects users without buyers.import", async () => {
      const res = await importBuyers()

      expect(res.status).toBe(403)
      expect(state.insertedBuyers).toEqual([])
    })

    test("allows admins to import buyers", async () => {
      state.callerRole = "admin"

      const res = await importBuyers()
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.insertedIds).toEqual(["buyer-1"])
      expect(state.insertedBuyers).toEqual([{ id: "buyer-1", fname: "Imported" }])
    })

    test("allows users granted buyers.import to import buyers", async () => {
      state.permissions = [{ user_id: "user-1", permission_key: "buyers.import", granted: true }]

      const res = await importBuyers()

      expect(res.status).toBe(200)
      expect(state.insertedBuyers).toHaveLength(1)
    })
  })
})
