// email_events.org_id has no service-role default in Phase 1B, so the SES
// webhook has to work out which tenant an event belongs to. The tag we set at
// send time is authoritative; after that we walk back through the rows the
// event references. Unresolved means skip the row, never fail the webhook.

import { NextRequest } from "next/server"

const state = vi.hoisted(() => ({
  eventUpserts: [] as any[],
  recipients: [] as Array<{ id: string; org_id: string | null; buyer_id?: string | null }>,
  campaigns: [] as Array<{ id: string; org_id: string | null }>,
  buyers: [] as Array<{ id: string; org_id: string | null }>,
  recipientUpdates: [] as any[],
}))

// Signature verification fetches an X.509 cert and RSA-verifies the payload.
// Override only createVerify so the rest of crypto stays real.
vi.mock("crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("crypto")>()
  const stubVerify = () => ({ update() {}, end() {}, verify: () => true })
  return {
    ...actual,
    createVerify: stubVerify,
    default: { ...actual, createVerify: stubVerify },
  }
})

vi.mock("@/lib/supabase", () => {
  const makeQuery = (table: string) => {
    const filters: Record<string, any> = {}
    const query: any = {
      select: () => query,
      eq: (col: string, val: any) => {
        filters[col] = val
        return query
      },
      or: () => query,
      maybeSingle: async () => {
        if (table === "campaign_recipients") {
          const row = state.recipients.find((r) => r.id === filters.id)
          return { data: row ?? null, error: null }
        }
        if (table === "campaigns") {
          const row = state.campaigns.find((c) => c.id === filters.id)
          return { data: row ?? null, error: null }
        }
        if (table === "buyers") {
          const row = state.buyers.find((b) => b.id === filters.id)
          return { data: row ?? null, error: null }
        }
        return { data: null, error: null }
      },
      update: () => ({
        eq: async () => {
          state.recipientUpdates.push(filters)
          return { error: null }
        },
      }),
      upsert: async (row: any) => {
        if (table === "email_events") state.eventUpserts.push(row)
        return { error: null }
      },
    }
    return query
  }
  const client = { from: (table: string) => makeQuery(table) }
  return { supabase: client, supabaseAdmin: client }
})

import { POST } from "../app/api/webhooks/ses/route"

const ORG_TAG = "00000000-0000-4000-8000-00000000000a"
const ORG_RECIPIENT = "00000000-0000-4000-8000-00000000000b"
const ORG_CAMPAIGN = "00000000-0000-4000-8000-00000000000c"
const ORG_BUYER = "00000000-0000-4000-8000-00000000000d"

function sesRequest(tags: Record<string, string[]>) {
  const sesPayload = {
    eventType: "Delivery",
    mail: {
      messageId: "msg-1",
      timestamp: "2026-10-05T00:00:00.000Z",
      tags,
    },
  }
  const snsMessage = {
    Type: "Notification",
    MessageId: `sns-${Math.round(performance.now() * 1000)}`,
    TopicArn: "arn:aws:sns:us-east-1:123456789012:ses-events",
    Timestamp: "2026-10-05T00:00:00.000Z",
    Message: JSON.stringify(sesPayload),
    Signature: "c2ln",
    SigningCertURL: "https://sns.us-east-1.amazonaws.com/cert.pem",
  }
  return new NextRequest("http://test/api/webhooks/ses", {
    method: "POST",
    body: JSON.stringify(snsMessage),
  })
}

describe("SES webhook — email_event org resolution", () => {
  beforeEach(() => {
    state.eventUpserts = []
    state.recipients = []
    state.campaigns = []
    state.buyers = []
    state.recipientUpdates = []
    // The cert fetch inside verifySnsSignature.
    // @ts-ignore
    global.fetch = vi.fn(async () => ({ ok: true, text: async () => "CERT" }))
  })

  test("resolves the org from the SES tag", async () => {
    state.recipients = [{ id: "r1", org_id: ORG_RECIPIENT }]

    const res = await POST(
      sesRequest({
        org_id: [ORG_TAG],
        recipient_id: ["r1"],
        campaign_id: ["c1"],
        buyer_id: ["b1"],
      }),
    )

    expect(res.status).toBe(200)
    expect(state.eventUpserts).toHaveLength(1)
    // The tag wins over every fallback.
    expect(state.eventUpserts[0].org_id).toBe(ORG_TAG)
  })

  test("ignores a tag that isn't a UUID and falls through", async () => {
    state.recipients = [{ id: "r1", org_id: ORG_RECIPIENT }]

    await POST(sesRequest({ org_id: ["not-a-uuid"], recipient_id: ["r1"] }))

    expect(state.eventUpserts[0].org_id).toBe(ORG_RECIPIENT)
  })

  test("falls back to the campaign recipient", async () => {
    state.recipients = [{ id: "r1", org_id: ORG_RECIPIENT }]
    state.campaigns = [{ id: "c1", org_id: ORG_CAMPAIGN }]

    await POST(sesRequest({ recipient_id: ["r1"], campaign_id: ["c1"] }))

    expect(state.eventUpserts[0].org_id).toBe(ORG_RECIPIENT)
  })

  test("falls back to the campaign when the recipient has no org", async () => {
    state.recipients = [{ id: "r1", org_id: null }]
    state.campaigns = [{ id: "c1", org_id: ORG_CAMPAIGN }]

    await POST(sesRequest({ recipient_id: ["r1"], campaign_id: ["c1"] }))

    expect(state.eventUpserts[0].org_id).toBe(ORG_CAMPAIGN)
  })

  test("falls back to the buyer last", async () => {
    state.buyers = [{ id: "b1", org_id: ORG_BUYER }]

    await POST(sesRequest({ buyer_id: ["b1"] }))

    expect(state.eventUpserts[0].org_id).toBe(ORG_BUYER)
  })

  test("unresolved org: no insert, still 200", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const log = vi.spyOn(console, "log").mockImplementation(() => {})

    const res = await POST(sesRequest({ campaign_id: ["unknown"] }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
    expect(state.eventUpserts).toHaveLength(0)
    warn.mockRestore()
    log.mockRestore()
  })
})
