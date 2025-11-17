import { describe, expect, test, beforeEach, jest } from "@jest/globals"

let buyers: any[] = []
let buyerGroups: any[] = []
let groups: any[] = []

const fetchMock = jest.fn()
global.fetch = fetchMock as any

jest.mock("../lib/supabase", () => {
  const client = {
    from: (table: string) => {
      if (table === "buyers") {
        return {
          select: () => ({
            eq: (col: string, id: string) => ({
              single: async () => ({ data: buyers.find((b) => b.id === id) || null, error: null }),
            }),
          }),
          update: (vals: any) => ({
            eq: (col: string, id: string) => {
              const idx = buyers.findIndex((b) => b.id === id)
              if (idx !== -1) buyers[idx] = { ...buyers[idx], ...vals }
              return Promise.resolve({ error: null })
            },
          }),
        }
      }
      if (table === "buyer_groups") {
        return {
          select: () => ({
            eq: (col: string, id: string) => {
              const data = buyerGroups
                .filter((bg) => bg.buyer_id === id)
                .map((bg) => ({ groups: groups.find((g) => g.id === bg.group_id) }))
              return Promise.resolve({ data, error: null })
            },
          }),
          delete: () => ({
            eq: (col: string, id: string) => {
              buyerGroups = buyerGroups.filter((bg) => bg.buyer_id !== id)
              return Promise.resolve({ error: null })
            },
          }),
        }
      }
      if (table === "groups") {
        return {
          select: () => ({
            eq: (col: string, id: string) => ({
              single: async () => ({ data: groups.find((g) => g.id === id) || null, error: null }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
  }
  return { supabase: client }
})


const { BuyerService } = require("../services/buyer-service")

describe("BuyerService deletions", () => {
  beforeEach(() => {
    buyers = [
      { id: "1", email: "a@test.com", fname: "A", sendfox_hidden: false },
      { id: "2", email: "b@test.com", fname: "B", sendfox_hidden: false },
    ]
    buyerGroups = []
    groups = []
    fetchMock.mockReset().mockResolvedValue({ ok: true })
    process.env.SENDFOX_DELETED_LIST_ID = "9"
  })

  test("deleteBuyer hides buyer and posts to SendFox", async () => {
    buyerGroups.push({ buyer_id: "1", group_id: "g1" })
    await BuyerService.deleteBuyer("1")
    const b = buyers.find((b) => b.id === "1")
    expect(b?.sendfox_hidden).toBe(true)
    expect(buyerGroups.length).toBe(0)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sendfox/contact",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "a@test.com",
          first_name: "A",
          lists: [9],
        }),
      }),
    )
  })

  test("deleteBuyers handles multiple ids", async () => {
    await BuyerService.deleteBuyers(["1", "2"])
    expect(buyers.every((b) => b.sendfox_hidden)).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    for (const call of fetchMock.mock.calls) {
      expect(call[0]).toBe("/api/sendfox/contact")
      expect(JSON.parse(call[1].body).lists).toEqual([9])
    }
  })
})
