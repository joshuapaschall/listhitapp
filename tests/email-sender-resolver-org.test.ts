// Cross-tenant sender spoofing. getVerifiedDomain used to look a domain up with
// no org filter and then echo the requested address back, so org B could send
// as anything@<org A's verified domain>.

const state = vi.hoisted(() => ({
  // (domain, orgId) -> status
  domains: [] as Array<{ domain: string; org_id: string; status: string }>,
  senders: [] as Array<{ from_email: string; org_id: string; from_name?: string | null; reply_to?: string | null; domain_id?: string }>,
  domainFilters: [] as Array<Record<string, any>>,
}))

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const filters: Record<string, any> = {}
      const query: any = {
        select: () => query,
        eq: (col: string, val: any) => {
          filters[col] = val
          return query
        },
        maybeSingle: async () => {
          if (table === "email_domains") {
            state.domainFilters.push({ ...filters })
            const row = state.domains.find(
              (d) =>
                (filters.domain === undefined || d.domain === filters.domain) &&
                (filters.org_id === undefined || d.org_id === filters.org_id) &&
                (filters.id === undefined || d.domain === filters.id),
            )
            return { data: row ? { id: row.domain, domain: row.domain, status: row.status } : null, error: null }
          }
          if (table === "email_senders") {
            const row = state.senders.find(
              (s) =>
                (filters.from_email === undefined || s.from_email === filters.from_email) &&
                (filters.org_id === undefined || s.org_id === filters.org_id),
            )
            return { data: row ?? null, error: null }
          }
          throw new Error(`Unexpected table ${table}`)
        },
      }
      return query
    },
  },
}))

import { resolveCampaignSender, SenderNotVerifiedError } from "@/lib/email-sender-resolver"

const ORG_A = "00000000-0000-4000-8000-00000000000a"
const ORG_B = "00000000-0000-4000-8000-00000000000b"

describe("resolveCampaignSender — requested sender", () => {
  beforeEach(() => {
    state.domains = [{ domain: "acme.test", org_id: ORG_A, status: "verified" }]
    state.senders = []
    state.domainFilters = []
  })

  test("a domain verified by ANOTHER org is refused", async () => {
    await expect(
      resolveCampaignSender(ORG_B, { fromEmail: "spoof@acme.test" }),
    ).rejects.toBeInstanceOf(SenderNotVerifiedError)

    // And the lookup really was org-scoped.
    expect(state.domainFilters[0]).toEqual(
      expect.objectContaining({ domain: "acme.test", org_id: ORG_B }),
    )
  })

  test("the refusal does not reveal that another org owns the domain", async () => {
    await expect(
      resolveCampaignSender(ORG_B, { fromEmail: "spoof@acme.test" }),
    ).rejects.toThrow(/isn't verified/i)
  })

  test("the same domain verified by the SAME org resolves", async () => {
    const sender = await resolveCampaignSender(ORG_A, { fromEmail: "hello@acme.test" })
    expect(sender).toEqual(
      expect.objectContaining({ fromEmail: "hello@acme.test", source: "campaign" }),
    )
  })

  test("a null org with a requested sender throws", async () => {
    await expect(
      resolveCampaignSender(null, { fromEmail: "hello@acme.test" }),
    ).rejects.toThrow("No organization context for sender.")
    // It never even reached the domain table.
    expect(state.domainFilters).toHaveLength(0)
  })

  test("an unverified domain owned by the caller's own org is still refused", async () => {
    state.domains = [{ domain: "pending.test", org_id: ORG_A, status: "pending" }]
    await expect(
      resolveCampaignSender(ORG_A, { fromEmail: "hi@pending.test" }),
    ).rejects.toBeInstanceOf(SenderNotVerifiedError)
  })
})
