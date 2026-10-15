// POST /api/dns/share: validates the address, is limited to 5 per org per
// hour, and the email carries the exact records in the provider's host format.

const h = vi.hoisted(() => ({
  db: null as any,
  sent: [] as any[],
  detectProvider: vi.fn(),
}))

vi.mock("@/lib/supabase", () => ({
  get supabaseAdmin() {
    return h.db.client
  },
}))
vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: async () => ({ user: { id: "user-1", email: "josh@example.com" }, orgId: "org-a", supabase: {} }),
}))
vi.mock("@/lib/dns/inspect", async () => {
  const actual = await vi.importActual<any>("@/lib/dns/inspect")
  return { ...actual, detectProvider: h.detectProvider }
})
vi.mock("@/lib/email/send-platform-email", () => ({
  sendPlatformEmail: async (email: any) => (h.sent.push(email), { sent: true }),
}))

import { makeDb } from "./helpers/dns-route-mocks"
import { POST } from "@/app/api/dns/share/route"

const share = (body: Record<string, unknown>) =>
  POST(new Request("http://x/api/dns/share", { method: "POST", body: JSON.stringify(body) }))

beforeEach(() => {
  h.sent = []
  h.db = makeDb({
    site_domains: [
      { id: "sd-a", org_id: "org-a", domain: "everystatehousebuyers.com", status: "pending", type: "custom", verification: null },
      { id: "sd-b", org_id: "org-b", domain: "someone-else.com", status: "pending", type: "custom", verification: null },
    ],
    organizations: [{ id: "org-a", name: "Every State", business_name: "Every State House Buyers" }],
    profiles: [{ id: "user-1", full_name: "Josh Paschall" }],
    dns_share_requests: [],
  })
  h.detectProvider.mockReset().mockResolvedValue({ key: "godaddy", label: "GoDaddy" })
})

describe("POST /api/dns/share", () => {
  test("invalid email → 400 with a plain message, nothing sent", async () => {
    const res = await share({ kind: "website", id: "sd-a", toEmail: "not-an-email" })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("Enter a valid email address.")
    expect(h.sent).toHaveLength(0)
  })

  test("the email contains the records (GoDaddy host format), provider steps and the note", async () => {
    const res = await share({ kind: "website", id: "sd-a", toEmail: "webguy@example.com", note: "Please add today" })
    expect(res.status).toBe(200)
    expect(h.sent).toHaveLength(1)
    const email = h.sent[0]
    expect(email.to).toBe("webguy@example.com")
    expect(email.category).toBe("dns_share")
    expect(email.replyTo).toBe("josh@example.com")
    expect(email.subject).toBe("Please add these records to everystatehousebuyers.com for Every State House Buyers")
    for (const s of ["76.76.21.21", "cname.vercel-dns.com", "Record 1 · Name: @", "Record 2 · Name: www", "Add New Record", "Please add today"]) {
      expect(email.text).toContain(s)
    }
    expect(email.text).not.toContain("**")
    expect(email.html).toContain("76.76.21.21")
  })

  test("6th share in an hour → 429", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await share({ kind: "website", id: "sd-a", toEmail: `p${i}@example.com` })).status).toBe(200)
    }
    const res = await share({ kind: "website", id: "sd-a", toEmail: "p6@example.com" })
    expect(res.status).toBe(429)
    expect(h.sent).toHaveLength(5)
  })

  test("another org's domain → 404", async () => {
    const res = await share({ kind: "website", id: "sd-b", toEmail: "a@example.com" })
    expect(res.status).toBe(404)
  })
})
