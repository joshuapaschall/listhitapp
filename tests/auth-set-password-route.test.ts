import { NextRequest } from "next/server"
import { POST } from "../app/api/auth/set-password/route"

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

const state = vi.hoisted(() => ({
  currentUser: { id: "u1" } as { id: string } | null,
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

describe("auth set-password route", () => {
  beforeEach(() => {
    state.currentUser = { id: "u1" }
    state.passwordUpdates = []
    state.profileUpdates = []
  })

  test("401s without a session", async () => {
    state.currentUser = null

    const res = await post({ password: "correct-horse-battery" })
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe("Your session expired. Open your invite link again.")
    expect(state.passwordUpdates).toEqual([])
  })

  test("rejects a password under the minimum length", async () => {
    const res = await post({ password: "short" })

    expect(res.status).toBe(400)
    expect(state.passwordUpdates).toEqual([])
  })

  test("sets the password and clears must_change_password", async () => {
    const res = await post({ password: "correct-horse-battery" })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(state.passwordUpdates).toEqual([{ id: "u1", password: "correct-horse-battery" }])
    expect(state.profileUpdates).toEqual([{ id: "u1", must_change_password: false }])
  })
})
