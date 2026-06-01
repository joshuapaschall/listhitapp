import { fetchKpis } from "../services/dashboard-service"

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
      in: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lt: vi.fn(() => builder),
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

describe("dashboard kpis", () => {
  test("fetchKpis returns all metrics", async () => {
    const { client, records } = createMockClient()
    const res = await fetchKpis("week", orgId, client)
    const keys = [
      "buyersAdded",
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
    records.forEach((record) => {
      expect(record.eq).toContainEqual(["org_id", orgId])
    })
  })
})
