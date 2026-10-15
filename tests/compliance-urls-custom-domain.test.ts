// resolveComplianceUrls with the real site-public-url helper: carriers must only
// ever see a custom domain whose DNS really resolves (site_domains.status =
// 'active'). A pending custom domain falls back to the free *.listhit.io URL.

const ORG = "33333333-3333-4333-8333-333333333333"

const h = vi.hoisted(() => ({ domains: [] as Array<Record<string, any>> }))

vi.mock("@/lib/supabase", () => {
  const table = (name: string) => {
    const filters: Array<[string, unknown]> = []
    const q: any = {
      select: () => q,
      eq: (col: string, val: unknown) => (filters.push([col, val]), q),
      in: () => q,
      order: () => q,
      limit: () => q,
      maybeSingle: async () => ({
        data:
          name === "organizations"
            ? { website_url: null }
            : name === "sites"
              ? { id: "site-1", slug: "acme" }
              : null,
        error: null,
      }),
      then: (res: any, rej: any) => {
        const rows = name === "site_domains" ? h.domains.filter((r) => filters.every(([c, v]) => r[c] === v)) : []
        return Promise.resolve({ data: rows, error: null }).then(res, rej)
      },
    }
    return q
  }
  return { supabaseAdmin: { from: table } }
})

import { resolveComplianceUrls } from "@/lib/org-twilio/compliance-urls"

const domain = (status: string) => ({
  org_id: ORG,
  site_id: "site-1",
  type: "custom",
  status,
  domain: "everystatehousebuyers.com",
  created_at: "2026-10-14T00:00:00Z",
})

beforeEach(() => {
  delete process.env.SITES_ROOT_DOMAIN
})

describe("resolveComplianceUrls — custom domains", () => {
  test("a pending custom domain is never used → *.listhit.io site URL", async () => {
    h.domains = [domain("pending")]
    const result = await resolveComplianceUrls(ORG)
    expect(result).toEqual({
      websiteUrl: "https://acme.listhit.io",
      privacyUrl: "https://acme.listhit.io/privacy",
      termsUrl: "https://acme.listhit.io/terms",
      hasListHitSite: true,
    })
    expect(JSON.stringify(result)).not.toContain("everystatehousebuyers.com")
  })

  test("an active custom domain is used", async () => {
    h.domains = [domain("active")]
    const result = await resolveComplianceUrls(ORG)
    expect(result).toMatchObject({ privacyUrl: "https://everystatehousebuyers.com/privacy" })
  })
})
