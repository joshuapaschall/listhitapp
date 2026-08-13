import { NextRequest } from "next/server"
import { POST } from "../app/api/admin/set-password/route"

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

const state = vi.hoisted(() => ({
  currentUser: { id: "admin-1" } as { id: string } | null,
  callerRole: "admin",
  profiles: [] as any[],
  passwordUpdates: [] as { id: string; password: string }[],
  profileUpdates: [] as any[],
}))

vi.mock("@/lib/supabase", () => {
  const client = {
    auth: {
      admin: {
        updateUserById: vi.fn(async (id: string, attrs: any) => {
          state.passwordUpdates.push({ id, password: attrs.password })
          return { data: { user: { id } }, error: null }
        }),
      },
    },
    from: (table: string) => {
      if (table !== "profiles") throw new Error(`Unexpected table ${table}`)
      return {
        select: () => ({
          eq: (_column: string, id: string) => ({
            maybeSingle: async () => {
              const profile =
                id === state.currentUser?.id
                  ? { ...state.profiles.find((p) => p.id === id), role: state.callerRole }
                  : state.profiles.find((p) => p.id === id)
              return { data: profile ?? null, error: null }
            },
          }),
        }),
        update: (value: any) => ({
          eq: async (_column: string, id: string) => {
            state.profileUpdates.push({ id, ...value })
            return { data: null, error: null }
          },
        }),
      }
    },
  }
  return { supabaseAdmin: client }
})

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: () => ({
    auth: { getUser: async () => ({ data: { user: state.currentUser }, error: null }) },
  }),
}))

function post(body: unknown) {
  return POST(new NextRequest("http://test", { method: "POST", body: JSON.stringify(body) }))
}

describe("admin set-password route", () => {
  beforeEach(() => {
    state.currentUser = { id: "admin-1" }
    state.callerRole = "admin"
    state.profiles = [
      { id: "admin-1", role: "admin", org_id: "org-A" },
      { id: "u1", role: "user", org_id: "org-A" },
      { id: "u2", role: "user", org_id: "org-B" },
    ]
    state.passwordUpdates = []
    state.profileUpdates = []
  })

  test("refuses a target in another org", async () => {
    const res = await post({ userId: "u2", password: "correct-horse-battery" })
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.reason).toBe("cross_org")
    expect(state.passwordUpdates).toEqual([])
  })

  test("rejects a password under the minimum length", async () => {
    const res = await post({ userId: "u1", password: "short" })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/at least 10 characters/)
    expect(state.passwordUpdates).toEqual([])
  })

  test("sets the password and requires a change by default", async () => {
    const res = await post({ userId: "u1", password: "correct-horse-battery" })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(state.passwordUpdates).toEqual([
      { id: "u1", password: "correct-horse-battery" },
    ])
    expect(state.profileUpdates).toEqual([{ id: "u1", must_change_password: true }])
  })

  test("honours requirePasswordChange: false", async () => {
    await post({
      userId: "u1",
      password: "correct-horse-battery",
      requirePasswordChange: false,
    })

    expect(state.profileUpdates).toEqual([{ id: "u1", must_change_password: false }])
  })

  test("never echoes the password back", async () => {
    const res = await post({ userId: "u1", password: "correct-horse-battery" })
    const text = await res.text()

    expect(text).not.toContain("correct-horse-battery")
  })
})
