// Self-serve org creation. This is the only path that may set profiles.org_id
// and role=owner, so the route must be idempotent, must never read an org or a
// role off the request body, and must roll its org back if it loses a race.

import { NextRequest } from "next/server"

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

const state = vi.hoisted(() => ({
  currentUser: { id: "user-1" } as { id: string } | null,
  profile: null as any,
  orgInserts: [] as any[],
  orgDeletes: [] as string[],
  profileUpdates: [] as { data: any; filters: Record<string, any>; isNull: string[] }[],
  // How many rows the profile update claims. 0 models losing the race.
  profileUpdateRows: 1,
  orgInsertError: null as any,
  tagInserts: [] as any[][],
  tagInsertError: null as any,
}))

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: () => ({
    auth: { getUser: async () => ({ data: { user: state.currentUser }, error: null }) },
  }),
}))

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: state.profile, error: null }) }),
          }),
          update: (data: any) => {
            const filters: Record<string, any> = {}
            const isNull: string[] = []
            const q: any = {
              eq: (col: string, val: any) => {
                filters[col] = val
                return q
              },
              is: (col: string, val: any) => {
                if (val === null) isNull.push(col)
                return q
              },
              select: async () => {
                state.profileUpdates.push({ data, filters, isNull })
                return {
                  data: state.profileUpdateRows ? [{ id: filters.id }] : [],
                  error: null,
                }
              },
            }
            return q
          },
        }
      }
      if (table === "organizations") {
        return {
          insert: (data: any) => ({
            select: () => ({
              single: async () => {
                state.orgInserts.push(data)
                if (state.orgInsertError) return { data: null, error: state.orgInsertError }
                return { data: { id: "org-new" }, error: null }
              },
            }),
          }),
          delete: () => ({
            eq: async (_col: string, id: string) => {
              state.orgDeletes.push(id)
              return { error: null }
            },
          }),
        }
      }
      if (table === "tags") {
        // A new org must get the system tags before anyone can use the app.
        return {
          insert: async (rows: any[]) => {
            state.tagInserts.push(rows)
            return { error: state.tagInsertError }
          },
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
  },
}))

import { POST } from "../app/api/onboarding/create-org/route"
import { SYSTEM_TAGS } from "@/lib/tags/system-tags"

const req = (body: unknown) =>
  new NextRequest("http://test/api/onboarding/create-org", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })

describe("POST /api/onboarding/create-org", () => {
  beforeEach(() => {
    state.currentUser = { id: "user-1" }
    state.profile = { id: "user-1", org_id: null, role: "user", must_change_password: false }
    state.orgInserts = []
    state.orgDeletes = []
    state.profileUpdates = []
    state.profileUpdateRows = 1
    state.orgInsertError = null
    state.tagInserts = []
    state.tagInsertError = null
  })

  test("401s with no session", async () => {
    state.currentUser = null
    const res = await POST(req({ companyName: "Acme Wholesale", name: "Jane" }))
    expect(res.status).toBe(401)
    expect(state.orgInserts).toHaveLength(0)
  })

  test("is idempotent when the profile already has an org", async () => {
    state.profile = { id: "user-1", org_id: "org-existing", role: "user" }
    const res = await POST(req({ companyName: "Acme Wholesale", name: "Jane" }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      ok: true,
      orgId: "org-existing",
      created: false,
    })
    // No second organization, no profile write.
    expect(state.orgInserts).toHaveLength(0)
    expect(state.profileUpdates).toHaveLength(0)
  })

  test("400s on a company name that is too short", async () => {
    const res = await POST(req({ companyName: "A", name: "Jane" }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/company name/i)
    expect(state.orgInserts).toHaveLength(0)
  })

  test("400s on a company name that is too long", async () => {
    const res = await POST(req({ companyName: "x".repeat(121), name: "Jane" }))
    expect(res.status).toBe(400)
    expect(state.orgInserts).toHaveLength(0)
  })

  test("400s on a missing name", async () => {
    const res = await POST(req({ companyName: "Acme Wholesale", name: "   " }))
    expect(res.status).toBe(400)
    expect(state.orgInserts).toHaveLength(0)
  })

  test("201 creates the org and makes the caller its owner", async () => {
    const res = await POST(req({ companyName: "  Acme Wholesale  ", name: "  Jane Doe  " }))
    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toEqual({ ok: true, orgId: "org-new", created: true })

    expect(state.orgInserts).toEqual([
      { name: "Acme Wholesale", business_name: "Acme Wholesale", owner_id: "user-1" },
    ])

    expect(state.profileUpdates).toHaveLength(1)
    expect(state.profileUpdates[0].data).toEqual({
      org_id: "org-new",
      role: "owner",
      full_name: "Jane Doe",
      display_name: "Jane Doe",
    })
    expect(state.profileUpdates[0].filters.id).toBe("user-1")
    expect(state.orgDeletes).toHaveLength(0)
  })

  test("the profile claim is guarded with .is(\"org_id\", null)", async () => {
    await POST(req({ companyName: "Acme Wholesale", name: "Jane" }))
    expect(state.profileUpdates[0].isNull).toContain("org_id")
  })

  test("never takes an orgId or role from the request body", async () => {
    await POST(
      req({
        companyName: "Acme Wholesale",
        name: "Jane",
        orgId: "org-someone-elses",
        role: "admin",
      }),
    )
    expect(state.orgInserts[0]).not.toHaveProperty("id")
    expect(state.profileUpdates[0].data.org_id).toBe("org-new")
    expect(state.profileUpdates[0].data.role).toBe("owner")
  })

  test("seeds the system tags for the new org", async () => {
    await POST(req({ companyName: "Acme Wholesale", name: "Jane" }))

    expect(state.tagInserts).toHaveLength(1)
    const rows = state.tagInserts[0]
    expect(rows).toHaveLength(SYSTEM_TAGS.length)
    expect(rows.map((row: any) => row.name).sort()).toEqual([...SYSTEM_TAGS].sort())
    // Protected means "code depends on this name" — all 20 qualify.
    expect(rows.every((row: any) => row.is_protected === true)).toBe(true)
    expect(rows.every((row: any) => row.org_id === "org-new")).toBe(true)
  })

  test("rolls the org back when the tag seed fails", async () => {
    state.tagInsertError = { message: "boom" }
    const err = vi.spyOn(console, "error").mockImplementation(() => {})

    const res = await POST(req({ companyName: "Acme Wholesale", name: "Jane" }))

    expect(res.status).toBe(500)
    expect(state.orgDeletes).toEqual(["org-new"])
    // An org without its vocabulary is worse than no org, so the profile is
    // never claimed either.
    expect(state.profileUpdates).toHaveLength(0)
    err.mockRestore()
  })

  test("rolls the org back when the profile claim affects 0 rows", async () => {
    state.profileUpdateRows = 0
    const res = await POST(req({ companyName: "Acme Wholesale", name: "Jane" }))
    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({
      error: "Your account was already assigned to an organization. Refresh the page.",
    })
    expect(state.orgDeletes).toEqual(["org-new"])
  })
})
