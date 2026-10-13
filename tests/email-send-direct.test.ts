// POST /api/email/send-direct — 1:1 buyer email through the org's verified
// SES sender. Covers auth, sender verification, the CAN-SPAM identity gate,
// opt-out enforcement (To and Cc/Bcc), footer/tags, history logging and
// HTML sanitization.

const h = vi.hoisted(() => {
  const state = {
    authUser: { id: "user-1" } as { id: string } | null,
    orgId: "org-a" as string | null,
    granted: new Set<string>(["inbox.send"]),
    tables: {} as Record<string, Array<Record<string, any>>>,
    inserts: [] as Array<{ table: string; row: Record<string, any> }>,
    insertError: null as any,
    identity: null as any,
  }

  const admin = {
    from: (table: string) => {
      const filters: Array<(r: any) => boolean> = []
      const rows = () => (state.tables[table] || []).filter((r) => filters.every((f) => f(r)))
      const q: any = {
        select: () => q,
        eq: (c: string, v: any) => (filters.push((r) => r[c] === v), q),
        in: (c: string, vs: any[]) => (filters.push((r) => vs.includes(r[c])), q),
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        then: (resolve: any, reject: any) => Promise.resolve({ data: rows(), error: null }).then(resolve, reject),
        insert: async (row: Record<string, any>) => {
          if (state.insertError) throw state.insertError
          state.inserts.push({ table, row })
          return { error: null }
        },
      }
      return q
    },
  }

  return { state, admin, sendSesEmail: vi.fn() }
})

vi.mock("@/lib/supabase", () => ({ supabaseAdmin: h.admin }))
vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: async () => ({ user: h.state.authUser, orgId: h.state.orgId, supabase: {} }),
}))
vi.mock("@/lib/permissions/server", () => ({
  hasPermission: async (_client: unknown, key: string) => h.state.granted.has(key),
}))
vi.mock("@/lib/org-identity.server", () => ({
  getOrgIdentity: async () => h.state.identity,
}))
vi.mock("@/lib/ses", () => ({ sendSesEmail: h.sendSesEmail }))

import { POST } from "../app/api/email/send-direct/route"
import { orgIdentityFromRow } from "@/lib/org-identity"

const COMPLETE_IDENTITY = orgIdentityFromRow({
  name: "Acme",
  business_name: "Acme Homes LLC",
  address_line1: "1 Main St",
  address_line2: null,
  city: "Austin",
  state: "TX",
  zip: "78701",
  phone: null,
  website_url: null,
})

const buyer = (over: Record<string, any> = {}) => ({
  id: "b-1",
  org_id: "org-a",
  fname: "Jane",
  lname: "Doe",
  full_name: "Jane Doe",
  email: "jane@buyer.test",
  email_norm: "jane@buyer.test",
  can_receive_email: true,
  email_suppressed: false,
  is_unsubscribed: false,
  unsubscribed_at: null,
  deleted_at: null,
  ...over,
})

const req = (body: Record<string, any>) =>
  new Request("http://localhost/api/email/send-direct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

const validBody = (over: Record<string, any> = {}) => ({
  senderId: "s-1",
  to: "jane@buyer.test",
  subject: "Hello",
  html: "<p>Hi Jane</p>",
  buyerId: "b-1",
  ...over,
})

describe("POST /api/email/send-direct", () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
    process.env.TELNYX_PINNED_ORG_IDS = "org-owner"
    process.env.SITE_URL = "https://app.listhit.test"
    process.env.EMAIL_UNSUBSCRIBE_SECRET = "test-secret"
    delete process.env.AWS_SES_FROM_EMAIL
    delete process.env.AWS_SES_FROM_NAME
    h.state.authUser = { id: "user-1" }
    h.state.orgId = "org-a"
    h.state.granted = new Set(["inbox.send"])
    h.state.identity = COMPLETE_IDENTITY
    h.state.inserts = []
    h.state.insertError = null
    h.state.tables = {
      email_senders: [
        { id: "s-1", org_id: "org-a", from_email: "deals@acme.test", from_name: "Acme Deals", reply_to: "reply@acme.test", domain_id: "d-1" },
        { id: "s-unverified", org_id: "org-a", from_email: "x@pending.test", from_name: null, reply_to: null, domain_id: "d-2" },
        { id: "s-other-org", org_id: "org-b", from_email: "b@b.test", from_name: null, reply_to: null, domain_id: "d-3" },
      ],
      email_domains: [
        { id: "d-1", org_id: "org-a", status: "verified" },
        { id: "d-2", org_id: "org-a", status: "pending" },
        { id: "d-3", org_id: "org-b", status: "verified" },
      ],
      buyers: [buyer()],
    }
    h.sendSesEmail.mockReset().mockResolvedValue({ MessageId: "msg-123" })
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  describe("auth", () => {
    test("401 without a user", async () => {
      h.state.authUser = null
      expect((await POST(req(validBody()))).status).toBe(401)
    })

    test("403 without an org", async () => {
      h.state.orgId = null
      expect((await POST(req(validBody()))).status).toBe(403)
    })

    test("403 without inbox.send or campaigns.send_email", async () => {
      h.state.granted = new Set()
      expect((await POST(req(validBody()))).status).toBe(403)
      expect(h.sendSesEmail).not.toHaveBeenCalled()
    })
  })

  describe("sender", () => {
    test.each([
      ["an unknown sender id", "s-missing"],
      ["another org's sender", "s-other-org"],
      ["a sender on an unverified domain", "s-unverified"],
    ])("403 for %s", async (_label, senderId) => {
      const res = await POST(req(validBody({ senderId })))
      expect(res.status).toBe(403)
      expect((await res.json()).error).toBe("That sender isn't verified for your organization.")
      expect(h.sendSesEmail).not.toHaveBeenCalled()
    })

    test("owner-env from a non-owner org is refused", async () => {
      process.env.AWS_SES_FROM_EMAIL = "owner@platform.test"
      const res = await POST(req(validBody({ senderId: "owner-env" })))
      expect(res.status).toBe(403)
      expect(h.sendSesEmail).not.toHaveBeenCalled()
    })

    test("owner-env works for the pinned owner org", async () => {
      h.state.orgId = "org-owner"
      h.state.tables.buyers = [buyer({ org_id: "org-owner" })]
      process.env.AWS_SES_FROM_EMAIL = "owner@platform.test"
      process.env.AWS_SES_FROM_NAME = "Owner"
      const res = await POST(req(validBody({ senderId: "owner-env" })))
      expect(res.status).toBe(200)
      expect(h.sendSesEmail).toHaveBeenCalledWith(
        expect.objectContaining({ fromEmail: "owner@platform.test", fromName: "Owner" }),
      )
    })
  })

  test("400 missing_business_address when the org address is incomplete", async () => {
    h.state.identity = orgIdentityFromRow({
      name: "Acme", business_name: null, address_line1: null, address_line2: null,
      city: null, state: null, zip: null, phone: null, website_url: null,
    })
    const res = await POST(req(validBody()))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe("missing_business_address")
    expect(h.sendSesEmail).not.toHaveBeenCalled()
  })

  describe("validation", () => {
    test.each([
      ["empty subject", { subject: "   " }],
      ["subject over 200 chars", { subject: "x".repeat(201) }],
      ["empty html", { html: "<p> </p>" }],
      ["invalid to", { to: "nope" }],
      ["invalid cc", { cc: ["bad"] }],
      ["more than 10 cc+bcc", { cc: Array.from({ length: 6 }, (_, i) => `c${i}@x.test`), bcc: Array.from({ length: 5 }, (_, i) => `b${i}@x.test`) }],
    ])("400 for %s", async (_label, over) => {
      const res = await POST(req(validBody(over)))
      expect(res.status).toBe(400)
      expect(typeof (await res.json()).error).toBe("string")
      expect(h.sendSesEmail).not.toHaveBeenCalled()
    })
  })

  describe("opt-outs", () => {
    test.each([
      ["can_receive_email = false", { can_receive_email: false }],
      ["email_suppressed", { email_suppressed: true }],
      ["unsubscribed_at set", { unsubscribed_at: "2026-09-01T00:00:00Z" }],
      ["deleted_at set", { deleted_at: "2026-09-01T00:00:00Z" }],
    ])("409 when the buyer has %s", async (_label, over) => {
      h.state.tables.buyers = [buyer(over)]
      const res = await POST(req(validBody()))
      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.code).toBe("recipient_opted_out")
      expect(body.error).toBe("Jane Doe has opted out of email. You can't email them.")
      expect(h.sendSesEmail).not.toHaveBeenCalled()
    })

    test("409 when the To address matches an opted-out buyer without a buyerId", async () => {
      h.state.tables.buyers = [buyer({ email_suppressed: true })]
      const res = await POST(req(validBody({ buyerId: null })))
      expect(res.status).toBe(409)
      expect(h.sendSesEmail).not.toHaveBeenCalled()
    })

    test("409 naming an opted-out cc address", async () => {
      h.state.tables.buyers = [
        buyer(),
        buyer({ id: "b-2", full_name: "Cc Person", email: "cc@buyer.test", email_norm: "cc@buyer.test", can_receive_email: false }),
      ]
      const res = await POST(req(validBody({ cc: ["CC@buyer.test"] })))
      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.code).toBe("recipient_opted_out")
      expect(body.error).toContain("CC@buyer.test")
      expect(h.sendSesEmail).not.toHaveBeenCalled()
    })

    test("404 for a buyerId from another org", async () => {
      h.state.tables.buyers = [buyer({ org_id: "org-b" })]
      const res = await POST(req(validBody()))
      expect(res.status).toBe(404)
      expect(h.sendSesEmail).not.toHaveBeenCalled()
    })
  })

  describe("success", () => {
    test("sends via the chosen sender with footer, tags and unsubscribe header, and logs history", async () => {
      const res = await POST(req(validBody({ cc: ["c@x.test"], bcc: ["b@x.test"] })))
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ ok: true, messageId: "msg-123" })

      expect(h.sendSesEmail).toHaveBeenCalledTimes(1)
      const args = h.sendSesEmail.mock.calls[0][0]
      expect(args).toEqual(
        expect.objectContaining({
          to: "jane@buyer.test",
          cc: ["c@x.test"],
          bcc: ["b@x.test"],
          subject: "Hello",
          fromEmail: "deals@acme.test",
          fromName: "Acme Deals",
          replyTo: "reply@acme.test",
        }),
      )
      expect(args.html).toContain("1 Main St, Austin, TX 78701")
      expect(args.html).toContain("unsubscribe here")
      expect(args.text).toBe("Hi Jane")
      expect(args.unsubscribeUrl).toMatch(/^https:\/\/app\.listhit\.test\/api\/unsubscribe\?id=b-1/)
      expect(args.html).toContain(args.unsubscribeUrl)
      expect(args.tags).toEqual(
        expect.objectContaining({ org_id: "org-a", buyer_id: "b-1", type: "direct", sender_user: "user-1" }),
      )

      const logged = h.state.inserts.filter((i) => i.table === "email_messages")
      expect(logged).toHaveLength(1)
      expect(logged[0].row).toEqual(
        expect.objectContaining({ org_id: "org-a", buyer_id: "b-1", subject: "Hello", preview: "Hi Jane" }),
      )
      expect(logged[0].row.thread_id).toMatch(/^ses:/)
    })

    test("a non-buyer recipient sends with a mailto footer and no history row", async () => {
      const res = await POST(req(validBody({ to: "stranger@else.test", buyerId: null })))
      expect(res.status).toBe(200)
      const args = h.sendSesEmail.mock.calls[0][0]
      expect(args.unsubscribeUrl).toBeUndefined()
      expect(args.html).toContain("mailto:deals@acme.test?subject=Unsubscribe")
      expect(args.html).toContain("1 Main St, Austin, TX 78701")
      expect(args.tags.buyer_id).toBeUndefined()
      expect(h.state.inserts.filter((i) => i.table === "email_messages")).toHaveLength(0)
    })

    test("SES failure → 502 with a generic message", async () => {
      h.sendSesEmail.mockRejectedValue(new Error("MessageRejected: Email address is not verified. secret-detail"))
      const res = await POST(req(validBody()))
      expect(res.status).toBe(502)
      const body = await res.json()
      expect(body.error).toBe("The email provider rejected this message. Try again or pick another sender.")
      expect(JSON.stringify(body)).not.toContain("secret-detail")
      expect(h.state.inserts).toHaveLength(0)
    })

    test("a history logging failure still returns 200", async () => {
      h.state.insertError = new Error("db down")
      const res = await POST(req(validBody()))
      expect(res.status).toBe(200)
      expect((await res.json()).ok).toBe(true)
    })
  })

  describe("html sanitization", () => {
    test("keeps editor formatting and strips unsafe markup", async () => {
      const html =
        '<p><strong>B</strong> <em>I</em> <u>U</u> <s>S</s> <a href="https://example.com/x">link</a></p>' +
        "<ul><li>one</li></ul><ol><li>two</li></ol><blockquote>quoted</blockquote><p><code>c</code></p>" +
        '<script>alert(1)</script><p onclick="steal()">click</p><a href="javascript:alert(1)">bad</a>'
      const res = await POST(req(validBody({ html })))
      expect(res.status).toBe(200)
      const sent: string = h.sendSesEmail.mock.calls[0][0].html
      for (const tag of ["<strong>B</strong>", "<em>I</em>", "<u>U</u>", "<s>S</s>", '<a href="https://example.com/x">link</a>', "<ul><li>one</li></ul>", "<ol><li>two</li></ol>", "<blockquote>quoted</blockquote>", "<code>c</code>"]) {
        expect(sent).toContain(tag)
      }
      expect(sent).not.toContain("<script")
      expect(sent).not.toContain("alert(1)")
      expect(sent).not.toContain("onclick")
      expect(sent).not.toContain("javascript:")
      expect(sent).toContain("<p>click</p>")
    })
  })
})
