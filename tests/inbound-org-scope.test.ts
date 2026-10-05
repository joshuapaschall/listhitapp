// Tenancy for inbound SMS. Before this, a buyer lookup with no org filter meant
// one phone number could fan a thread — and a STOP — out across every tenant
// that happened to hold it. The receiving DID is now the tenant signal, and
// Telnyx (owner-only) is the single case that may fall back to the pinned org.

const h = vi.hoisted(() => {
  const state = {
    buyers: [] as any[],
    buyerOrgFilters: [] as string[],
    messages: [] as any[],
    threadUpserts: [] as any[],
    anonThreadCalls: [] as any[],
    // e164 -> org_id
    dids: {} as Record<string, string>,
  }
  const client = {
    from: (table: string) => {
      if (table === "buyers") {
        return {
          select: () => ({
            eq: (_col: string, orgId: string) => ({
              or: (expr: string) => {
                state.buyerOrgFilters.push(orgId)
                const nums = expr.split(",").map((s) => s.split(".eq.")[1])
                return Promise.resolve({
                  data: state.buyers.filter(
                    (b) => b.org_id === orgId && nums.includes(b.phone_norm),
                  ),
                  error: null,
                })
              },
            }),
          }),
        }
      }
      if (table === "inbound_numbers") {
        return {
          select: () => ({
            eq: (_col: string, e164: string) => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: state.dids[e164] ? { org_id: state.dids[e164] } : null,
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      if (table === "campaign_recipients") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
            }),
          }),
          update: () => ({ eq: async () => ({ error: null }) }),
        }
      }
      if (table === "message_threads") {
        return {
          upsert: (row: any) => {
            state.threadUpserts.push(row)
            return { select: () => ({ single: async () => ({ data: { id: "t1" }, error: null }) }) }
          },
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { filtered_at: null, filter_overridden: false },
                error: null,
              }),
            }),
          }),
          update: () => ({ eq: async () => ({ error: null }) }),
        }
      }
      if (table === "messages") {
        return {
          insert: async (rows: any) => {
            const arr = Array.isArray(rows) ? rows : [rows]
            state.messages.push(...arr)
            return { data: arr, error: null }
          },
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
  }
  return { state, client }
})

vi.mock("@/lib/supabase", () => ({ supabase: h.client, supabaseAdmin: h.client }))
vi.mock("@/lib/telnyx", () => ({
  TELNYX_API_URL: "https://api.telnyx.com/v2",
  telnyxHeaders: () => ({ Authorization: "Bearer KEY" }),
}))
vi.mock("@/lib/sms/negative-keywords", () => ({ matchNegativeKeyword: async () => null }))
vi.mock("@/lib/sms/suppress", () => ({ suppressBuyerSms: async () => {} }))
vi.mock("@/lib/dnc/phones", () => ({ recordDncPhone: async () => {} }))
vi.mock("@/services/thread-utils", () => ({
  upsertAnonThread: async (phone: string, preferredFrom: string | null, orgId: string) => {
    h.state.anonThreadCalls.push({ phone, preferredFrom, orgId })
    return { data: { id: "t-anon" }, error: null }
  },
}))
vi.mock("@/utils/mms.server", () => ({ ensurePublicMediaUrls: async (u: string[]) => u }))

import { handleInboundSms } from "@/lib/sms/inbound-handler"

const PINNED_ORG = "00000000-0000-4000-8000-000000000001"
const TWILIO_ORG = "00000000-0000-4000-8000-000000000002"
const KNOWN_DID = "+18885551234"
const UNKNOWN_DID = "+18885559999"

const event = (provider: "telnyx" | "twilio", to: string) => ({
  provider,
  from: "+12223334444",
  to,
  text: "hi there",
  rawMediaUrls: [] as string[],
  providerId: "IN1",
})

describe("inbound SMS org scoping", () => {
  beforeEach(() => {
    h.state.buyers = []
    h.state.buyerOrgFilters = []
    h.state.messages = []
    h.state.threadUpserts = []
    h.state.anonThreadCalls = []
    h.state.dids = { [KNOWN_DID]: TWILIO_ORG }
    process.env.TELNYX_PINNED_ORG_IDS = PINNED_ORG
  })

  afterEach(() => {
    delete process.env.TELNYX_PINNED_ORG_IDS
  })

  test("a Twilio inbound to an unknown DID is dropped with no writes", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {})
    const res = await handleInboundSms(event("twilio", UNKNOWN_DID))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ received: true, dropped: "unknown_did" })
    expect(h.state.messages).toHaveLength(0)
    expect(h.state.threadUpserts).toHaveLength(0)
    expect(h.state.anonThreadCalls).toHaveLength(0)
    // It never even reached the buyers table.
    expect(h.state.buyerOrgFilters).toHaveLength(0)
    err.mockRestore()
  })

  test("a Telnyx inbound to an unknown DID falls back to the pinned org", async () => {
    const res = await handleInboundSms(event("telnyx", UNKNOWN_DID))

    expect(res.status).toBe(204)
    expect(h.state.buyerOrgFilters).toEqual([PINNED_ORG])
    expect(h.state.anonThreadCalls[0].orgId).toBe(PINNED_ORG)
    expect(h.state.messages[0].org_id).toBe(PINNED_ORG)
  })

  test("a Telnyx inbound with no pinned org is dropped too", async () => {
    delete process.env.TELNYX_PINNED_ORG_IDS
    const err = vi.spyOn(console, "error").mockImplementation(() => {})
    const res = await handleInboundSms(event("telnyx", UNKNOWN_DID))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ received: true, dropped: "unknown_did" })
    expect(h.state.messages).toHaveLength(0)
    err.mockRestore()
  })

  test("the buyers query is scoped to the org the DID resolves to", async () => {
    h.state.buyers = [
      { id: "b-right", org_id: TWILIO_ORG, phone_norm: "12223334444", can_receive_sms: true, blocked_at: null },
      // Same phone number, different tenant. It must not be touched.
      { id: "b-wrong", org_id: PINNED_ORG, phone_norm: "12223334444", can_receive_sms: true, blocked_at: null },
    ]

    const res = await handleInboundSms(event("twilio", KNOWN_DID))

    expect(res.status).toBe(204)
    expect(h.state.buyerOrgFilters).toEqual([TWILIO_ORG])
    expect(h.state.messages).toHaveLength(1)
    expect(h.state.messages[0].buyer_id).toBe("b-right")
    expect(h.state.threadUpserts).toHaveLength(1)
    expect(h.state.threadUpserts[0].buyer_id).toBe("b-right")
  })

  test("threads and messages are written with an explicit org_id", async () => {
    h.state.buyers = [
      { id: "b-right", org_id: TWILIO_ORG, phone_norm: "12223334444", can_receive_sms: true, blocked_at: null },
    ]

    await handleInboundSms(event("twilio", KNOWN_DID))

    expect(h.state.threadUpserts[0]).toEqual(expect.objectContaining({ org_id: TWILIO_ORG }))
    expect(h.state.messages[0]).toEqual(expect.objectContaining({ org_id: TWILIO_ORG }))
  })

  test("an unmatched sender still gets an org-scoped anonymous thread", async () => {
    await handleInboundSms(event("twilio", KNOWN_DID))

    expect(h.state.anonThreadCalls).toEqual([
      { phone: "2223334444", preferredFrom: KNOWN_DID, orgId: TWILIO_ORG },
    ])
    expect(h.state.messages[0].org_id).toBe(TWILIO_ORG)
  })
})
