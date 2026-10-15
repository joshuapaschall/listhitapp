// A custom domain is "active" only when Vercel says ownership is verified AND
// DNS actually points at Vercel (domain config misconfigured === false).
// Vercel's `verified` alone only proves ownership, so it must never mark a
// domain live on its own. Apex domains also get www.<apex> as a 308 redirect.

const h = vi.hoisted(() => {
  const state: any = {
    row: null as any,
    inserted: null as any,
    updated: null as any,
  }
  const supabase: any = {
    from: (table: string) => {
      const q: any = {
        _patch: null,
        select: () => q,
        eq: () => q,
        order: () => q,
        insert: (row: any) => ((state.inserted = row), q),
        update: (patch: any) => ((q._patch = patch), q),
        maybeSingle: async () => ({
          data: table === "sites" ? { id: "site-1" } : table === "site_domains" ? state.row : null,
          error: null,
        }),
        single: async () => {
          if (q._patch) {
            state.updated = { ...state.row, ...q._patch }
            return { data: state.updated, error: null }
          }
          return { data: { id: "dom-1", ...state.inserted }, error: null }
        },
      }
      return q
    },
  }
  const vercel = {
    addProjectDomain: vi.fn(),
    addProjectRedirectDomain: vi.fn(),
    getProjectDomain: vi.fn(),
    verifyProjectDomain: vi.fn(),
    getDomainConfig: vi.fn(),
  }
  return { state, supabase, vercel }
})

vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: vi.fn(async () => ({ user: { id: "u1" }, orgId: "org-1", supabase: h.supabase })),
}))
vi.mock("@/lib/vercel/domains", async () => {
  const actual = await vi.importActual<any>("@/lib/vercel/domains")
  return { ...actual, ...h.vercel, vercelConfigured: () => true }
})

import { POST as addDomain } from "@/app/api/sites/[id]/domains/route"
import { POST as verifyDomain } from "@/app/api/sites/[id]/domains/[domainId]/verify/route"
import { dnsRecordsFor } from "@/lib/vercel/domains"

const addCtx = { params: Promise.resolve({ id: "site-1" }) }
const verifyCtx = { params: Promise.resolve({ id: "site-1", domainId: "dom-1" }) }
const addReq = (domain: string) =>
  new Request("http://x/api/sites/site-1/domains", { method: "POST", body: JSON.stringify({ domain }) })

beforeEach(() => {
  h.state.row = { id: "dom-1", domain: "example.com", status: "active", verification: null }
  h.state.inserted = null
  h.state.updated = null
  Object.values(h.vercel).forEach((f) => f.mockReset())
  h.vercel.verifyProjectDomain.mockResolvedValue({})
  h.vercel.addProjectRedirectDomain.mockResolvedValue(undefined)
})

describe("verify route", () => {
  test("verified but DNS misconfigured → pending (stale active row corrected)", async () => {
    h.vercel.getProjectDomain.mockResolvedValue({ name: "example.com", verified: true })
    h.vercel.getDomainConfig.mockResolvedValue({ misconfigured: true })
    const res = await verifyDomain(new Request("http://x", { method: "POST" }), verifyCtx)
    const json = await res.json()
    expect(json.domain.status).toBe("pending")
    expect(h.state.updated.status).toBe("pending")
  })

  test("verified and DNS configured → active", async () => {
    h.vercel.getProjectDomain.mockResolvedValue({ name: "example.com", verified: true })
    h.vercel.getDomainConfig.mockResolvedValue({ misconfigured: false })
    const res = await verifyDomain(new Request("http://x", { method: "POST" }), verifyCtx)
    expect((await res.json()).domain.status).toBe("active")
  })

  test("config check failing → pending, never active", async () => {
    h.vercel.getProjectDomain.mockResolvedValue({ name: "example.com", verified: true })
    h.vercel.getDomainConfig.mockRejectedValue(new Error("boom"))
    const res = await verifyDomain(new Request("http://x", { method: "POST" }), verifyCtx)
    expect((await res.json()).domain.status).toBe("pending")
  })
})

describe("add route", () => {
  test("apex domain → www redirect added; verified but misconfigured → pending", async () => {
    h.vercel.addProjectDomain.mockResolvedValue({ name: "everystatehousebuyers.com", verified: true })
    h.vercel.getDomainConfig.mockResolvedValue({ misconfigured: true })
    const res = await addDomain(addReq("everystatehousebuyers.com"), addCtx)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(h.vercel.addProjectRedirectDomain).toHaveBeenCalledWith("www.everystatehousebuyers.com", "everystatehousebuyers.com")
    expect(h.state.inserted.status).toBe("pending")
  })

  test("www redirect failure is non-fatal", async () => {
    h.vercel.addProjectDomain.mockResolvedValue({ name: "example.com", verified: false })
    h.vercel.addProjectRedirectDomain.mockRejectedValue(new Error("nope"))
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const res = await addDomain(addReq("example.com"), addCtx)
    expect((await res.json()).ok).toBe(true)
    expect(h.state.inserted.status).toBe("pending")
    spy.mockRestore()
  })

  test("subdomain → no www redirect", async () => {
    h.vercel.addProjectDomain.mockResolvedValue({ name: "homes.example.com", verified: true })
    h.vercel.getDomainConfig.mockResolvedValue({ misconfigured: false })
    await addDomain(addReq("homes.example.com"), addCtx)
    expect(h.vercel.addProjectRedirectDomain).not.toHaveBeenCalled()
    expect(h.state.inserted.status).toBe("active")
  })
})

describe("dnsRecordsFor", () => {
  test("apex → A @ and CNAME www, plus ownership TXT", () => {
    const records = dnsRecordsFor("example.com", [
      { type: "TXT", domain: "_vercel.example.com", value: "vc-domain-verify=example.com,abc" },
    ])
    expect(records).toEqual(
      expect.arrayContaining([
        { kind: "routing", type: "A", host: "@", value: "76.76.21.21" },
        { kind: "routing", type: "CNAME", host: "www", value: "cname.vercel-dns.com" },
        { kind: "ownership", type: "TXT", host: "_vercel.example.com", value: "vc-domain-verify=example.com,abc" },
      ]),
    )
  })

  test("subdomain → a single CNAME for its label", () => {
    expect(dnsRecordsFor("homes.example.com")).toEqual([
      { kind: "routing", type: "CNAME", host: "homes", value: "cname.vercel-dns.com" },
    ])
  })
})
