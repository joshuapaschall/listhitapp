import { describe, expect, test, beforeEach } from "@jest/globals"
import { ShowingService } from "../services/showing-service"

let showings: any[] = []
let idCounter = 1

jest.mock("../lib/supabase", () => {
  const client = {
      from: (table: string) => {
        if (table !== "showings") throw new Error(`Unexpected table ${table}`)

        return {
          insert: (rows: any[]) => {
            const record = { id: String(idCounter++), ...rows[0] }
            showings.push(record)
            return {
              select: () => ({ single: async () => ({ data: record, error: null }) })
            }
          },

          select: () => {
            let result = [...showings]
            const chain: any = {
              order: () => chain,
              eq: (column: string, value: any) => {
                result = result.filter((r) => r[column] === value)
                return chain
              },
              gte: (column: string, value: any) => {
                result = result.filter((r) => r[column] >= value)
                return chain
              },
              lte: (column: string, value: any) => {
                result = result.filter((r) => r[column] <= value)
                return chain
              },
              then: async (resolve: any) => resolve({ data: result, error: null })
            }
            return chain
          },
        }
      },
    }
  return { supabase: client, supabaseAdmin: client }
})

describe("ShowingService", () => {
  beforeEach(() => {
    showings = []
    idCounter = 1
  })

  test("addShowing inserts and returns record", async () => {
    const showing = await ShowingService.addShowing({
      property_id: "p1",
      buyer_id: "b1",
      scheduled_at: "2024-01-01T00:00:00Z"
    })

    expect(showing.id).toBeDefined()
    expect(showing.property_id).toBe("p1")
  })

  test("getShowings filters by buyerId", async () => {
    await ShowingService.addShowing({ property_id: "p1", buyer_id: "b1", scheduled_at: "2024-01-01T00:00:00Z" })
    await ShowingService.addShowing({ property_id: "p2", buyer_id: "b2", scheduled_at: "2024-01-02T00:00:00Z" })

    const results = await ShowingService.getShowings({ buyerId: "b1" })
    expect(results.length).toBe(1)
    expect(results[0].buyer_id).toBe("b1")
  })

  test("getShowings filters by date range", async () => {
    await ShowingService.addShowing({ property_id: "p1", buyer_id: "b1", scheduled_at: "2024-01-01T00:00:00Z" })
    await ShowingService.addShowing({ property_id: "p2", buyer_id: "b2", scheduled_at: "2024-02-01T00:00:00Z" })

    const results = await ShowingService.getShowings({ startDate: "2024-01-15", endDate: "2024-02-15" })
    expect(results.length).toBe(1)
    expect(results[0].scheduled_at).toBe("2024-02-01T00:00:00Z")
  })
})
