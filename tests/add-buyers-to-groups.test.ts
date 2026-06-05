import { __setBuyerGroups } from "@/lib/supabase"
import { addBuyersToGroups } from "../lib/group-service"

let buyerGroups: any[] = []

vi.mock("@/lib/supabase", () => {
  const client = {
    from: (table: string) => {
      if (table === "buyer_groups") {
        return {
          // Models upsert(onConflict: "buyer_id,group_id", ignoreDuplicates: true):
          // rows that collide with an existing (buyer_id, group_id) pair are skipped.
          upsert: (rows: any[], _opts?: any) => {
            for (const r of rows) {
              const exists = buyerGroups.some(
                (bg) => bg.buyer_id === r.buyer_id && bg.group_id === r.group_id,
              )
              if (!exists) buyerGroups.push(r)
            }
            return Promise.resolve({ error: null })
          },
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
  }
  return {
    supabase: client,
    supabaseAdmin: client,
    __setBuyerGroups: (data: any[]) => { buyerGroups = data },
  }
})

describe("addBuyersToGroups", () => {
  beforeEach(() => {
    buyerGroups = [{ buyer_id: "1", group_id: "g1" }]
    __setBuyerGroups(buyerGroups)
    global.fetch = vi.fn(async () => new Response("{}", { status: 200 })) as any
  })

  test("avoids duplicates without SendFox sync", async () => {
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
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
