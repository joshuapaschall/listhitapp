// GET /api/dns/check: org-scoped (another org's domain is a 404), and the
// recommended DMARC record is shown but never blocks "all set".

const h = vi.hoisted(() => ({
  db: null as any,
  user: { id: "user-1", email: "josh@example.com" } as any,
  orgId: "org-a",
  checkRecords: vi.fn(),
  detectProvider: vi.fn(),
  checkHttps: vi.fn(),
}))

vi.mock("@/lib/supabase", () => ({
  get supabaseAdmin() {
    return h.db.client
  },
}))
vi.mock("@/lib/auth/org-context", () => ({ requireOrgContext: async () => ({ user: h.user, orgId: h.orgId, supabase: {} }) }))
vi.mock("@/lib/dns/inspect", async () => {
  const actual = await vi.importActual<any>("@/lib/dns/inspect")
  return { ...actual, checkRecords: h.checkRecords, detectProvider: h.detectProvider, checkHttps: h.checkHttps }
})

import { makeDb } from "./helpers/dns-route-mocks"
import { GET } from "@/app/api/dns/check/route"

const call = (kind: string, id: string) => GET(new Request(`http://x/api/dns/check?kind=${kind}&id=${id}`))

beforeEach(() => {
  h.orgId = "org-a"
  h.db = makeDb({
    email_domains: [
      { id: "em-a", org_id: "org-a", domain: "a-homes.com", status: "pending", dkim_tokens: ["t1", "t2", "t3"], ses_region: "us-east-1" },
      { id: "em-b", org_id: "org-b", domain: "b-homes.com", status: "pending", dkim_tokens: ["t1"], ses_region: "us-east-1" },
      { id: "em-c", org_id: "org-a", domain: "c-homes.com", status: "pending", dkim_tokens: ["t1"], ses_region: "us-east-1" },
    ],
    site_domains: [{ id: "sd-a", org_id: "org-a", domain: "a-homes-site.com", status: "pending", type: "custom", verification: null }],
  })
  h.detectProvider.mockReset().mockResolvedValue({ key: "godaddy", label: "GoDaddy" })
  h.checkHttps.mockReset().mockResolvedValue({ ok: false })
  // Everything found except the optional DMARC record.
  h.checkRecords.mockReset().mockImplementation(async (expected: any[]) =>
    expected.map((e) => ({
      type: e.type,
      host: e.host,
      expectedValue: e.value,
      optional: Boolean(e.optional),
      found: e.optional ? [] : [e.value],
      status: e.optional ? "missing" : "ok",
      hint: e.optional ? "We don't see this record yet." : "",
    })),
  )
})

describe("GET /api/dns/check", () => {
  test("another org's domain → 404, and nothing is looked up", async () => {
    const res = await call("email", "em-b")
    expect(res.status).toBe(404)
    expect(h.checkRecords).not.toHaveBeenCalled()
  })

  test("a missing optional DMARC record doesn't block allRequiredOk", async () => {
    const res = await call("email", "em-a")
    expect(res.status).toBe(200)
    const body = await res.json()
    const dmarc = body.records.find((r: any) => r.host === "_dmarc.a-homes.com")
    expect(dmarc).toMatchObject({ optional: true, status: "missing" })
    expect(body.allRequiredOk).toBe(true)
    expect(body.provider).toMatchObject({ key: "godaddy", hostFormat: "relative" })
    expect(body.provider.dnsUrl).toContain("a-homes.com")
    expect(body.https).toBeUndefined()
  })

  test("website domains include the https check and the apex + www records", async () => {
    const res = await call("website", "sd-a")
    const body = await res.json()
    expect(body.https).toEqual({ ok: false })
    expect(body.records.map((r: any) => `${r.type} ${r.host}`)).toEqual(["A a-homes-site.com", "CNAME www.a-homes-site.com"])
  })

  test("results are cached per domain for 20 seconds", async () => {
    await call("email", "em-c")
    await call("email", "em-c")
    expect(h.checkRecords).toHaveBeenCalledTimes(1)
  })

  test("bad kind → 400", async () => {
    expect((await call("ftp", "em-a")).status).toBe(400)
  })
})
