// GET /api/email/sender-options — the From list every email composer uses.
// Verified-domain senders only, org-scoped, default first; the owner env
// address is offered to the pinned owner org alone.

const h = vi.hoisted(() => {
  const state = {
    authUser: { id: "user-1" } as { id: string } | null,
    orgId: "org-a" as string | null,
    granted: new Set<string>(["inbox.send"]),
    senders: [] as Array<Record<string, any>>,
    senderFilters: [] as Array<Array<[string, any]>>,
  }

  const getPath = (row: any, path: string) => path.split(".").reduce((v, k) => (v == null ? v : v[k]), row)

  const admin = {
    from: (table: string) => {
      if (table !== "email_senders") throw new Error(`Unexpected table ${table}`)
      const filters: Array<[string, any]> = []
      const orders: Array<[string, boolean]> = []
      const run = () => {
        state.senderFilters.push(filters)
        let rows = state.senders.filter((r) => filters.every(([c, v]) => getPath(r, c) === v))
        for (const [col, asc] of [...orders].reverse()) {
          rows = [...rows].sort((a, b) => {
            const av = a[col] ?? ""
            const bv = b[col] ?? ""
            if (av === bv) return 0
            return (av > bv ? 1 : -1) * (asc ? 1 : -1)
          })
        }
        return { data: rows, error: null }
      }
      const q: any = {
        select: () => q,
        eq: (c: string, v: any) => (filters.push([c, v]), q),
        order: (c: string, o?: { ascending?: boolean }) => (orders.push([c, o?.ascending !== false]), q),
        then: (resolve: any, reject: any) => Promise.resolve(run()).then(resolve, reject),
      }
      return q
    },
  }
  return { state, admin }
})

vi.mock("@/lib/supabase", () => ({ supabaseAdmin: h.admin }))
vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: async () => ({ user: h.state.authUser, orgId: h.state.orgId, supabase: {} }),
}))
vi.mock("@/lib/permissions/server", () => ({
  hasPermission: async (_client: unknown, key: string) => h.state.granted.has(key),
}))

import { GET } from "../app/api/email/sender-options/route"

const sender = (over: Record<string, any>) => ({
  id: "s",
  org_id: "org-a",
  from_email: "a@acme.test",
  from_name: null,
  reply_to: null,
  is_default: false,
  email_domains: { status: "verified" },
  ...over,
})

describe("GET /api/email/sender-options", () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
    delete process.env.AWS_SES_FROM_EMAIL
    delete process.env.AWS_SES_FROM_NAME
    process.env.TELNYX_PINNED_ORG_IDS = "org-owner"
    h.state.authUser = { id: "user-1" }
    h.state.orgId = "org-a"
    h.state.granted = new Set(["inbox.send"])
    h.state.senderFilters = []
    h.state.senders = [
      sender({ id: "s-zed", from_email: "zed@acme.test" }),
      sender({ id: "s-def", from_email: "team@acme.test", from_name: "Team", is_default: true, reply_to: "r@acme.test" }),
      sender({ id: "s-pending", from_email: "pending@acme.test", email_domains: { status: "pending" } }),
      sender({ id: "s-other", org_id: "org-b", from_email: "other@b.test" }),
    ]
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  test("401 without a user", async () => {
    h.state.authUser = null
    expect((await GET()).status).toBe(401)
  })

  test("403 without an org", async () => {
    h.state.orgId = null
    expect((await GET()).status).toBe(403)
  })

  test("403 without inbox.send or campaigns.send_email", async () => {
    h.state.granted = new Set(["settings.email_domains"])
    const res = await GET()
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual(expect.objectContaining({ error: "Forbidden" }))
  })

  test("campaigns.send_email alone is enough", async () => {
    h.state.granted = new Set(["campaigns.send_email"])
    expect((await GET()).status).toBe(200)
  })

  test("returns only verified, org-scoped senders with the default first", async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const { senders } = await res.json()
    expect(senders).toEqual([
      { id: "s-def", fromEmail: "team@acme.test", fromName: "Team", replyTo: "r@acme.test", isDefault: true },
      { id: "s-zed", fromEmail: "zed@acme.test", fromName: null, replyTo: null, isDefault: false },
    ])
    expect(h.state.senderFilters[0]).toEqual(
      expect.arrayContaining([
        ["org_id", "org-a"],
        ["email_domains.status", "verified"],
      ]),
    )
  })

  test("owner-env is appended for the pinned org when the env address is set", async () => {
    h.state.orgId = "org-owner"
    h.state.senders = []
    process.env.AWS_SES_FROM_EMAIL = "owner@platform.test"
    process.env.AWS_SES_FROM_NAME = "Owner"
    const { senders } = await (await GET()).json()
    expect(senders).toEqual([
      { id: "owner-env", fromEmail: "owner@platform.test", fromName: "Owner", replyTo: null, isDefault: true },
    ])
  })

  test("owner-env is not the default when verified senders exist", async () => {
    h.state.orgId = "org-owner"
    h.state.senders = [sender({ id: "s-own", org_id: "org-owner", from_email: "deals@own.test", is_default: true })]
    process.env.AWS_SES_FROM_EMAIL = "owner@platform.test"
    const { senders } = await (await GET()).json()
    expect(senders.map((s: any) => [s.id, s.isDefault])).toEqual([
      ["s-own", true],
      ["owner-env", false],
    ])
  })

  test("owner-env is not duplicated when a verified sender already has that address", async () => {
    h.state.orgId = "org-owner"
    h.state.senders = [sender({ id: "s-own", org_id: "org-owner", from_email: "owner@platform.test" })]
    process.env.AWS_SES_FROM_EMAIL = "owner@platform.test"
    const { senders } = await (await GET()).json()
    expect(senders.map((s: any) => s.id)).toEqual(["s-own"])
  })

  test("owner-env is never offered to a non-pinned org", async () => {
    process.env.AWS_SES_FROM_EMAIL = "owner@platform.test"
    const { senders } = await (await GET()).json()
    expect(senders.some((s: any) => s.id === "owner-env")).toBe(false)
  })
})
