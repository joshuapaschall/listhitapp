import { describe, expect, test, beforeEach, jest } from "@jest/globals"
import { addBuyersToGroups } from "../lib/group-service"

let buyerGroups: any[] = []

jest.mock("../lib/supabase", () => {
  const client = {
    from: (table: string) => {
      if (table === "buyer_groups") {
        return {
          select: () => ({
            in: (col1: string, vals1: any[]) => ({
              in: (col2: string, vals2: any[]) => {
                const data = buyerGroups.filter(
                  (bg) => vals1.includes(bg[col1]) && vals2.includes(bg[col2]),
                )
                return Promise.resolve({ data, error: null })
              },
            }),
          }),
          insert: (rows: any[]) => {
            buyerGroups.push(...rows)
            return Promise.resolve({ error: null })
          },
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
  }
  return { supabase: client }
})

describe("addBuyersToGroups", () => {
  beforeEach(() => {
    buyerGroups = [{ buyer_id: "1", group_id: "g1" }]
    global.fetch = jest.fn().mockResolvedValue({ ok: true })
  })

  test("avoids duplicates and syncs buyers", async () => {
    await addBuyersToGroups(["1", "2"], ["g1", "g2"])

    expect(buyerGroups).toEqual(
      expect.arrayContaining([
        { buyer_id: "1", group_id: "g1" },
        { buyer_id: "1", group_id: "g2" },
        { buyer_id: "2", group_id: "g1" },
        { buyer_id: "2", group_id: "g2" },
      ]),
    )
    expect(buyerGroups.length).toBe(4)
    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/sendfox/sync-buyer-lists",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerId: "1" }),
      }),
    )
  })
})
