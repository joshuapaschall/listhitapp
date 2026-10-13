// /api/cron/twilio-registration — the polling fallback. Cron-auth only; picks
// only due orgs in in-flight stages; one org's failure never stops the batch.

const h = vi.hoisted(() => ({
  filters: [] as Array<[string, ...unknown[]]>,
  rows: [] as Array<{ org_id: string }>,
  advance: vi.fn(),
}))

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== "org_twilio") throw new Error(`unexpected table ${table}`)
      const q: any = {
        select: (...a: unknown[]) => (h.filters.push(["select", ...a]), q),
        in: (...a: unknown[]) => (h.filters.push(["in", ...a]), q),
        or: (...a: unknown[]) => (h.filters.push(["or", ...a]), q),
        order: (...a: unknown[]) => (h.filters.push(["order", ...a]), q),
        limit: async (...a: unknown[]) => {
          h.filters.push(["limit", ...a])
          return { data: h.rows, error: null }
        },
      }
      return q
    },
  },
}))
vi.mock("@/lib/org-twilio/engine", () => ({ advanceRegistration: h.advance }))

import { NextRequest } from "next/server"
import { POST } from "../app/api/cron/twilio-registration/route"

const call = (token?: string) =>
  POST(
    new NextRequest("https://app.listhit.io/api/cron/twilio-registration", {
      method: "POST",
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  )

describe("cron: twilio-registration", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret"
    h.filters = []
    h.rows = [{ org_id: "org-a" }, { org_id: "org-b" }, { org_id: "org-c" }]
    h.advance.mockReset().mockResolvedValue({ stage: "in_review", changed: false })
  })

  test("requires cron auth", async () => {
    const res = await call()
    expect(res.status).toBe(401)
    expect(h.advance).not.toHaveBeenCalled()
    const wrong = await call("nope")
    expect([401, 403]).toContain(wrong.status)
    expect(h.advance).not.toHaveBeenCalled()
  })

  test("queries only due orgs in in-flight stages, 25 at a time, oldest check first", async () => {
    const res = await call("cron-secret")
    expect(res.status).toBe(200)
    expect(h.filters).toContainEqual(["in", "setup_stage", ["submitting", "in_review", "verify_mobile"]])
    const or = h.filters.find((f) => f[0] === "or")
    expect(or?.[1]).toMatch(/^next_check_at\.is\.null,next_check_at\.lte\./)
    expect(h.filters).toContainEqual(["limit", 25])
    expect(h.filters.find((f) => f[0] === "order")?.[1]).toBe("next_check_at")
  })

  test("advances each org sequentially with reason cron", async () => {
    await call("cron-secret")
    expect(h.advance.mock.calls.map((c) => c[0])).toEqual(["org-a", "org-b", "org-c"])
    expect(h.advance).toHaveBeenCalledWith("org-a", { reason: "cron" })
  })

  test("one org's throw doesn't stop the others", async () => {
    h.advance.mockImplementation(async (orgId: string) => {
      if (orgId === "org-b") throw new Error("twilio down")
      return { stage: "in_review", changed: false }
    })
    const res = await call("cron-secret")
    expect(res.status).toBe(200)
    expect(h.advance).toHaveBeenCalledTimes(3)
    const json = await res.json()
    expect(json.results).toEqual([
      { orgId: "org-a", stage: "in_review" },
      { orgId: "org-b", error: true },
      { orgId: "org-c", stage: "in_review" },
    ])
  })
})
