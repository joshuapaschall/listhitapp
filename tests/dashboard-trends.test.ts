import {
  fetchCallTrends,
  fetchEmailTrends,
  fetchOfferTrends,
  fetchShowingTrends,
  fetchTextTrends,
  fetchUnsubscribeTrends,
} from "../services/dashboard-service"

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

async function expectOrgScoped(run: (client: any) => Promise<unknown>) {
  const { client, records } = createMockClient()
  const res = await run(client)

  expect(res).toHaveProperty("data")
  expect(res).toHaveProperty("delta")
  records.forEach((record) => {
    expect(record.eq).toContainEqual(["org_id", orgId])
  })
}

describe("dashboard trends", () => {
  test("fetchTextTrends returns data", async () => {
    await expectOrgScoped((client) => fetchTextTrends("week", orgId, client))
  })

  test("fetchCallTrends returns data", async () => {
    await expectOrgScoped((client) => fetchCallTrends("week", orgId, client))
  })

  test("fetchEmailTrends returns data", async () => {
    await expectOrgScoped((client) => fetchEmailTrends("week", orgId, client))
  })

  test("fetchOfferTrends returns data", async () => {
    await expectOrgScoped((client) => fetchOfferTrends("week", orgId, client))
  })

  test("fetchShowingTrends returns data", async () => {
    await expectOrgScoped((client) => fetchShowingTrends("week", orgId, client))
  })

  test("fetchUnsubscribeTrends returns data", async () => {
    await expectOrgScoped((client) => fetchUnsubscribeTrends("week", orgId, client))
  })
})
