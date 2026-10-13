// resolveComplianceUrls: the privacy/terms URLs an A2P campaign cites must be
// real pages — a published ListHit site's own, or ones the customer entered.
// Never a guessed `<external site>/privacy`.

const ORG = "22222222-2222-4222-8222-222222222222"

const h = vi.hoisted(() => ({
  org: null as Record<string, any> | null,
  site: null as Record<string, any> | null,
  a2p: null as Record<string, any> | null,
  publicUrl: vi.fn(),
}))

vi.mock("@/lib/supabase", () => {
  const table = (name: string) => {
    const q: any = {
      select: () => q,
      eq: () => q,
      order: () => q,
      limit: () => q,
      maybeSingle: async () => ({
        data: name === "organizations" ? h.org : name === "sites" ? h.site : name === "a2p_registration" ? h.a2p : null,
        error: null,
      }),
    }
    return q
  }
  return { supabaseAdmin: { from: table } }
})
vi.mock("@/lib/websites/site-public-url", () => ({ fetchSitePublicUrl: h.publicUrl }))

import { resolveComplianceUrls } from "@/lib/org-twilio/compliance-urls"

describe("resolveComplianceUrls", () => {
  beforeEach(() => {
    h.org = { website_url: null }
    h.site = null
    h.a2p = null
    h.publicUrl.mockReset().mockResolvedValue("https://acme.listhit.io")
  })

  test("published ListHit site → its /privacy and /terms, site URL as website", async () => {
    h.site = { id: "site-1", slug: "acme" }
    const result = await resolveComplianceUrls(ORG)
    expect(result).toEqual({
      websiteUrl: "https://acme.listhit.io",
      privacyUrl: "https://acme.listhit.io/privacy",
      termsUrl: "https://acme.listhit.io/terms",
      hasListHitSite: true,
    })
    expect(h.publicUrl).toHaveBeenCalledWith(expect.anything(), ORG, "site-1", "acme")
  })

  test("published ListHit site + an https org website → that website, site's policy pages", async () => {
    h.site = { id: "site-1", slug: "acme" }
    h.org = { website_url: "https://acmehomes.com" }
    const result = await resolveComplianceUrls(ORG)
    expect(result).toMatchObject({
      websiteUrl: "https://acmehomes.com",
      privacyUrl: "https://acme.listhit.io/privacy",
      termsUrl: "https://acme.listhit.io/terms",
    })
  })

  test("external site with stored https privacy/terms → the stored URLs", async () => {
    h.org = { website_url: "https://acmehomes.com" }
    h.a2p = { privacy_policy_url: "https://acmehomes.com/legal/privacy-policy", terms_url: "https://acmehomes.com/legal/tos" }
    const result = await resolveComplianceUrls(ORG)
    expect(result).toEqual({
      websiteUrl: "https://acmehomes.com",
      privacyUrl: "https://acmehomes.com/legal/privacy-policy",
      termsUrl: "https://acmehomes.com/legal/tos",
      hasListHitSite: false,
    })
  })

  test("external site without stored URLs → needs_website (never <external>/privacy)", async () => {
    h.org = { website_url: "https://acmehomes.com" }
    const result = await resolveComplianceUrls(ORG)
    expect(result).toEqual({ error: "needs_website" })
    expect(JSON.stringify(result)).not.toContain("acmehomes.com/privacy")
  })

  test("non-https stored URLs don't count", async () => {
    h.org = { website_url: "https://acmehomes.com" }
    h.a2p = { privacy_policy_url: "http://acmehomes.com/privacy", terms_url: "https://acmehomes.com/terms" }
    expect(await resolveComplianceUrls(ORG)).toEqual({ error: "needs_website" })
  })

  test("no site and no website → needs_website", async () => {
    expect(await resolveComplianceUrls(ORG)).toEqual({ error: "needs_website" })
  })
})
