import { describe, test, beforeEach, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"
import { POST } from "../app/api/groups/replace-for-buyers/route"

const DEFAULT_GROUP_ID = "g0"
let buyerGroups: any[] = []

global.fetch = jest.fn()

jest.mock("../lib/supabase", () => {
  const client = {
    rpc: (_fn: string, args: any) => {
      const { buyer_ids, target_group_ids, keep_default } = args
      const defaultId = DEFAULT_GROUP_ID
      if (keep_default) {
        buyerGroups = buyerGroups.filter(
          (bg) =>
            !(buyer_ids.includes(bg.buyer_id) && bg.group_id !== defaultId),
        )
      } else {
        buyerGroups = buyerGroups.filter(
          (bg) => !buyer_ids.includes(bg.buyer_id),
        )
      }
      for (const b of buyer_ids) {
        for (const g of target_group_ids) {
          if (!buyerGroups.find((bg) => bg.buyer_id === b && bg.group_id === g)) {
            buyerGroups.push({ buyer_id: b, group_id: g })
          }
        }
        if (keep_default) {
          if (!buyerGroups.find((bg) => bg.buyer_id === b && bg.group_id === defaultId)) {
            buyerGroups.push({ buyer_id: b, group_id: defaultId })
          }
        }
      }
      const changed_rows = BigInt(buyer_ids.length)
      return Promise.resolve({ error: null, data: { changed_rows } })
    },
  }
  return { supabase: client, supabaseAdmin: client }
})

describe("replace groups for buyers route", () => {
  beforeEach(() => {
    buyerGroups = [
      { buyer_id: "1", group_id: "g1" },
      { buyer_id: "1", group_id: "g3" },
      { buyer_id: "2", group_id: "g2" },
    ]
    ;(global.fetch as jest.Mock).mockReset().mockResolvedValue({ ok: true })
  })

  test("replaces memberships and syncs", async () => {
    const req = new NextRequest("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buyerIds: ["1", "2"], targetGroupIds: ["g1", "g2"] }),
    })
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(Number(body.changedRows)).toBe(2)
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
  })

  test("replace with one group leaves only that group", async () => {
    const req = new NextRequest("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buyerIds: ["1"], targetGroupIds: ["g2"] }),
    })
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(Number(body.changedRows)).toBe(1)
    expect(buyerGroups.filter((bg) => bg.buyer_id === "1")).toEqual([
      { buyer_id: "1", group_id: "g2" },
    ])
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  test("replace with empty array removes all memberships", async () => {
    const req = new NextRequest("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buyerIds: ["1"], targetGroupIds: [] }),
    })
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(Number(body.changedRows)).toBe(1)
    expect(buyerGroups.filter((bg) => bg.buyer_id === "1")).toEqual([])
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  test("keepDefault retains default group", async () => {
    buyerGroups.push({ buyer_id: "1", group_id: DEFAULT_GROUP_ID })
    const req = new NextRequest("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buyerIds: ["1"], targetGroupIds: [], keepDefault: true }),
    })
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(Number(body.changedRows)).toBe(1)
    expect(buyerGroups.filter((bg) => bg.buyer_id === "1")).toEqual([
      { buyer_id: "1", group_id: DEFAULT_GROUP_ID },
    ])
  })
})
