const sendSesEmailMock = vi.fn()
const updateCalls: Array<{ table: string; updates: Record<string, any> }> = []
let claimedJobs: any[] = []

process.env.SITE_URL = "https://example.test"
process.env.SES_COST_PER_EMAIL_USD = "0.1234"
process.env.EMAIL_SEND_DELAY_MS = "0"
process.env.EMAIL_RETRY_BACKOFF_MS = "0"

vi.mock("../lib/ses", () => ({
  sendSesEmail: sendSesEmailMock,
}))

vi.mock("../lib/ses-quota", () => ({
  getSesQuota: vi.fn(async () => ({
    maxSendRate: 10,
    max24HourSend: 1000,
    sentLast24Hours: 0,
  })),
}))

vi.mock("../lib/unsubscribe", () => ({
  appendUnsubscribeFooter: (html: string) => html,
  buildUnsubscribeUrl: () => "https://example.test/unsubscribe",
}))

vi.mock("../lib/email/deliverability-guard", () => ({
  evaluateCampaignSafety: vi.fn(() => ({ trip: false })),
}))

vi.mock("../lib/notifications", () => ({
  insertNotification: vi.fn(),
}))

vi.mock("../lib/user-context", () => ({
  getUserMergeContext: vi.fn(async () => ({})),
}))

function createEqQuery(result: any) {
  const query: any = {
    eq: () => query,
    in: () => query,
    not: () => query,
    maybeSingle: async () => result,
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  }
  return query
}

function createCountQuery(count = 0) {
  const query: any = {
    eq: () => query,
    in: () => query,
    not: () => query,
    maybeSingle: async () => ({ data: { status: "processing" }, error: null }),
    then: (resolve: any) => Promise.resolve({ count, data: [], error: null }).then(resolve),
  }
  return query
}

vi.mock("../lib/supabase", () => ({
  supabaseAdmin: {
    rpc: (name: string) => {
      if (name === "claim_email_queue_jobs") return Promise.resolve({ data: claimedJobs, error: null })
      return Promise.resolve({ data: [], error: null })
    },
    from: (table: string) => ({
      select: (_columns?: string, options?: { count?: string; head?: boolean }) => {
        if (table === "ses_reputation_snapshots") {
          return { order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }
        }
        if (table === "campaign_recipients" && options?.head) return createCountQuery(0)
        if (table === "email_campaign_queue" && options?.head) return createCountQuery(0)
        if (table === "email_campaign_content") return { in: async () => ({ data: [{ campaign_id: "campaign-1", subject: "Hi", html: "Hello" }], error: null }) }
        if (table === "campaigns") {
          return {
            in: async () => ({ data: [{ id: "campaign-1", user_id: "user-1" }], error: null }),
            eq: () => ({ maybeSingle: async () => ({ data: { status: "processing" }, error: null }) }),
          }
        }
        throw new Error(`Unexpected select on ${table}`)
      },
      update: (updates: Record<string, any>) => {
        updateCalls.push({ table, updates })
        return createEqQuery({ data: null, error: null })
      },
    }),
  },
}))

async function importSender() {
  vi.resetModules()
  return import("../services/campaign-sender")
}

describe("processEmailQueue SES cost stamping", () => {
  beforeEach(() => {
    updateCalls.length = 0
    claimedJobs = [{
      id: "job-1",
      campaign_id: "campaign-1",
      recipient_id: "recipient-1",
      attempts: 0,
      max_attempts: 3,
      payload: {
        campaignId: "campaign-1",
        contact: {
          email: "buyer@example.test",
          buyerId: "buyer-1",
          recipientId: "recipient-1",
        },
      },
    }]
    sendSesEmailMock.mockReset()
  })

  test("adds actual_cost_usd to successful sent recipient updates", async () => {
    sendSesEmailMock.mockResolvedValue({ MessageId: "ses-message-1" })
    const { processEmailQueue } = await importSender()

    await processEmailQueue(1, { workerId: "test-worker" })

    expect(updateCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "campaign_recipients",
          updates: expect.objectContaining({
            status: "sent",
            actual_cost_usd: 0.1234,
          }),
        }),
      ]),
    )
  })

  test("does not add actual_cost_usd to failed recipient updates", async () => {
    sendSesEmailMock.mockRejectedValue(new Error("SES failed"))
    const { processEmailQueue } = await importSender()

    await processEmailQueue(1, { workerId: "test-worker" })

    const failureRecipientUpdate = updateCalls.find(
      (call) => call.table === "campaign_recipients" && call.updates.status === "error",
    )
    expect(failureRecipientUpdate?.updates).toEqual(
      expect.not.objectContaining({ actual_cost_usd: expect.anything() }),
    )
  })
})
