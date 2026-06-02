vi.unmock("@/services/email-metrics-service")
vi.unmock("../services/email-metrics-service")
vi.mock("../services/gmail-metrics-service", () => ({
  getGmailMetrics: vi.fn(),
}))

const recipientRows = [
  { org_id: "org-1", campaign_id: "campaign-1", actual_cost_usd: "0.0001" },
  { org_id: "org-1", campaign_id: "campaign-1", actual_cost_usd: 0.0002 },
  { org_id: "org-1", campaign_id: "campaign-2", actual_cost_usd: "0.0003" },
  { org_id: "org-2", campaign_id: "campaign-1", actual_cost_usd: "9.9999" },
]

function createCampaignRecipientsQuery(selectColumns: string) {
  const filters: Record<string, string> = {}
  const query: any = {
    eq: (column: string, value: string) => {
      filters[column] = value
      return query
    },
    is: () => query,
    not: () => Promise.resolve({ data: [] }),
    then: (resolve: any) => {
      const data = recipientRows
        .filter((row) => Object.entries(filters).every(([column, value]) => (row as any)[column] === value))
        .map((row) => {
          if (selectColumns === "actual_cost_usd") return { actual_cost_usd: row.actual_cost_usd }
          return row
        })
      return Promise.resolve({ data, error: null }).then(resolve)
    },
  }
  return query
}

vi.mock("../lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      select: (columns: string) => {
        if (table !== "campaign_recipients") throw new Error(`Unexpected table ${table}`)
        return createCampaignRecipientsQuery(columns)
      },
    }),
  },
}))

import { getEmailCampaignCostMetrics, updateEmailMetrics } from "../services/email-metrics-service"
import { getGmailMetrics } from "../services/gmail-metrics-service"

describe("updateEmailMetrics", () => {
  test("continues when Gmail metrics fail", async () => {
    ;(getGmailMetrics as vi.Mock).mockRejectedValue(new Error("token"))
    const result = await updateEmailMetrics("u1")
    expect(result).toEqual({ unsubscribed: 0, bounces: 0, opens: 0 })
  })
})

describe("getEmailCampaignCostMetrics", () => {
  test("returns totalCostUsd as the org-scoped campaign recipient cost sum", async () => {
    const result = await getEmailCampaignCostMetrics("org-1", "campaign-1")

    expect(result).toEqual({ totalCostUsd: 0.00030000000000000003 })
  })
})
