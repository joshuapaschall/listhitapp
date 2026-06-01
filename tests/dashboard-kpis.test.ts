import { fetchFunnel, fetchKpis, fetchLiveDeals, fetchNeedsYouToday, fetchProfitMetrics } from "../services/dashboard-service"

const orgId = "00000000-0000-0000-0000-000000000123"

type QueryRecord = {
  table: string
  select?: string
  options?: unknown
  eq: Array<[string, unknown]>
}

function createMockClient() {
  const records: QueryRecord[] = []

  const createBuilder = (record: QueryRecord): any => {
    const builder: any = {
      select: vi.fn((select?: string, options?: unknown) => {
        record.select = select
        record.options = options
        return builder
      }),
      eq: vi.fn((column: string, value: unknown) => {
        record.eq.push([column, value])
        return builder
      }),
      is: vi.fn(() => builder),
      not: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      in: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lt: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      then: (resolve: (value: { data: unknown[]; count: number; error: null }) => void) => {
        resolve({ data: [], count: 0, error: null })
      },
    }

    return builder
  }

  const client = {
    from: vi.fn((table: string) => {
      const record: QueryRecord = { table, eq: [] }
      records.push(record)
      return createBuilder(record)
    }),
  }

  return { client: client as any, records }
}

function expectEveryQueryScoped(records: QueryRecord[]) {
  expect(records.length).toBeGreaterThan(0)
  records.forEach((record) => {
    expect(record.eq).toContainEqual(["org_id", orgId])
  })
}

describe("dashboard kpis", () => {
  test("fetchKpis returns all metrics", async () => {
    const { client, records } = createMockClient()
    const res = await fetchKpis("week", orgId, client)
    const keys = [
      "buyersAdded",
      "buyersAddedDelta",
      "propertiesAdded",
      "activeProperties",
      "underContract",
      "soldProperties",
      "totalProperties",
      "hotBuyers",
      "followUpsDue",
      "totalContacts",
      "textsSent",
      "textsSentDelta",
      "textsReceived",
      "textsReceivedDelta",
      "callsMade",
      "callsMadeDelta",
      "callsReceived",
      "callsReceivedDelta",
      "voicemailsLeft",
      "emailsSent",
      "emailsSentDelta",
      "emailsOpened",
      "emailBounces",
      "openRate",
      "clickRate",
      "bounceRate",
      "smsUnsubscribes",
      "emailUnsubscribes",
      "unsubscribeRate",
      "unsubscribeRateDelta",
      "campaignsRunning",
      "campaignRoi",
      "offersCreated",
      "offersCreatedDelta",
      "offersAccepted",
      "offersAcceptedDelta",
      "offersDeclined",
      "offersCountered",
      "showingsScheduled",
      "showingsScheduledDelta",
      "showingsRescheduled",
      "showingsCancelled",
      "showingsCompleted",
      "grossProfit",
      "netProfit",
      "avgAssignmentFee",
      "closeRate",
    ]

    keys.forEach((k) => {
      expect(res).toHaveProperty(k)
      expect(typeof (res as any)[k]).toBe("number")
    })
    expect(records.length).toBeGreaterThanOrEqual(30)
    expectEveryQueryScoped(records)
  })

  test("new dashboard data functions scope every query to the org", async () => {
    const profitClient = createMockClient()
    await fetchProfitMetrics("week", orgId, profitClient.client)
    expectEveryQueryScoped(profitClient.records)

    const liveDealsClient = createMockClient()
    await fetchLiveDeals(orgId, liveDealsClient.client)
    expectEveryQueryScoped(liveDealsClient.records)

    const needsYouTodayClient = createMockClient()
    await fetchNeedsYouToday(orgId, needsYouTodayClient.client)
    expectEveryQueryScoped(needsYouTodayClient.records)

    const funnelClient = createMockClient()
    await fetchFunnel("week", orgId, funnelClient.client)
    expectEveryQueryScoped(funnelClient.records)
  })

  test("fetchProfitMetrics returns empty-state values without fabricated ROI", async () => {
    const { client } = createMockClient()
    const res = await fetchProfitMetrics("week", orgId, client)

    expect(res).toEqual({
      grossProfit: 0,
      closedCount: 0,
      avgAssignmentFee: 0,
      marketingSpend: 0,
      netProfit: 0,
      marketingRoi: null,
      hasData: false,
    })
  })
})
