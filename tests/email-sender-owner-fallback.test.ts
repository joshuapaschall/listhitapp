// AWS_SES_FROM_EMAIL is the platform operator's own address. Letting another
// tenant fall back to it would send their campaign from the operator's domain —
// their buyers would see the wrong company in the From line.

const state = vi.hoisted(() => ({
  senders: [] as Array<{ from_email: string; org_id: string; is_default?: boolean; domain_id?: string }>,
  domains: [] as Array<{ domain: string; org_id: string; status: string }>,
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
          if (table === "email_senders") {
            const row = state.senders.find(
              (s) =>
                (filters.org_id === undefined || s.org_id === filters.org_id) &&
                (filters.from_email === undefined || s.from_email === filters.from_email) &&
                (filters.is_default === undefined || s.is_default === filters.is_default),
            )
            return { data: row ?? null, error: null }
          }
          if (table === "email_domains") {
            const row = state.domains.find(
              (d) =>
                (filters.domain === undefined || d.domain === filters.domain) &&
                (filters.org_id === undefined || d.org_id === filters.org_id) &&
                (filters.id === undefined || d.domain === filters.id),
            )
            return { data: row ? { id: row.domain, domain: row.domain, status: row.status } : null, error: null }
          }
          throw new Error(`Unexpected table ${table}`)
        },
      }
      return query
    },
  },
}))

import { resolveCampaignSender, SenderNotVerifiedError } from "@/lib/email-sender-resolver"

const OWNER_ORG = "00000000-0000-4000-8000-0000000000aa"
const OTHER_ORG = "00000000-0000-4000-8000-0000000000bb"

describe("env sender fallback is owner-only", () => {
  beforeEach(() => {
    state.senders = []
    state.domains = []
    process.env.TELNYX_PINNED_ORG_IDS = OWNER_ORG
    process.env.AWS_SES_FROM_EMAIL = "deals@operator.test"
    process.env.AWS_SES_FROM_NAME = "Operator"
  })

  afterEach(() => {
    delete process.env.TELNYX_PINNED_ORG_IDS
    delete process.env.AWS_SES_FROM_EMAIL
    delete process.env.AWS_SES_FROM_NAME
  })

  test("the owner org with no sender falls back to the env sender", async () => {
    const sender = await resolveCampaignSender(OWNER_ORG, {})
    expect(sender).toEqual({
      fromEmail: "deals@operator.test",
      fromName: "Operator",
      replyTo: undefined,
      source: "env",
    })
  })

  test("a non-owner org with no sender is refused, not given the operator's address", async () => {
    await expect(resolveCampaignSender(OTHER_ORG, {})).rejects.toBeInstanceOf(
      SenderNotVerifiedError,
    )
    await expect(resolveCampaignSender(OTHER_ORG, {})).rejects.toThrow(
      "Add and verify a sending domain in Settings → Email Domains before sending email.",
    )
  })

  test("a null org is refused too", async () => {
    await expect(resolveCampaignSender(null, {})).rejects.toBeInstanceOf(SenderNotVerifiedError)
  })

  test("a non-owner org WITH its own default sender still resolves", async () => {
    state.domains = [{ domain: "tenant.test", org_id: OTHER_ORG, status: "verified" }]
    state.senders = [
      {
        from_email: "hello@tenant.test",
        org_id: OTHER_ORG,
        is_default: true,
        domain_id: "tenant.test",
      },
    ]

    const sender = await resolveCampaignSender(OTHER_ORG, {})
    expect(sender).toEqual(
      expect.objectContaining({ fromEmail: "hello@tenant.test", source: "org_default" }),
    )
  })

  test("the owner org is refused when the env sender is unset too", async () => {
    delete process.env.AWS_SES_FROM_EMAIL
    await expect(resolveCampaignSender(OWNER_ORG, {})).rejects.toThrow(
      "No verified sender is configured.",
    )
  })
})
