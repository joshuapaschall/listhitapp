/** @jest-environment jsdom */
import { importBuyersFromCsv } from "../components/buyers/import-buyers-modal"

let buyers: any[] = []
let tags: string[] = []
let buyerGroups: any[] = []
let idCounter = 1
const originalFetch = global.fetch

const groupService = {
  addBuyersToGroups: vi.fn(async (buyerIds: string[], groupIds: string[]) => {
    for (const b of buyerIds) {
      for (const g of groupIds) {
        buyerGroups.push({ buyer_id: b, group_id: g })
      }
    }
  }),
}

vi.mock("../lib/supabase", () => {
  const client = {
      from: (table: string) => {
        if (table === "tags") {
          return {
            select: async () => ({ data: tags.map((name) => ({ name })), error: null }),
          }
        }
        if (table === "buyers") {
          return {
            insert: (rows: any[]) => {
              const recs = rows.map((r) => ({ id: `b${idCounter++}`, ...r }))
              buyers.push(...recs)
              return { select: () => ({ data: recs, error: null }) }
            },
            select: () => ({
              in: async (col: string, vals: any[]) => ({
                data: buyers.filter((b) => vals.includes(b[col])),
                error: null,
              }),
            }),
            update: (data: any) => ({
              eq: async (_col: string, val: any) => {
                const idx = buyers.findIndex((b) => b.id === val)
                if (idx !== -1) buyers[idx] = { ...buyers[idx], ...data }
                return { error: null }
              },
            }),
          }
        }
        throw new Error(`Unexpected table ${table}`)
      },
    }
  return { supabase: client, supabaseAdmin: client }
})

vi.mock("../lib/group-service", () => ({
  addBuyersToGroups: (...args: any[]) => groupService.addBuyersToGroups(...args),
}))


describe("importBuyersFromCsv", () => {
  beforeEach(() => {
    buyers = []
    tags = ["VIP", "oldtag"]
    buyerGroups = []
    idCounter = 1
    groupService.addBuyersToGroups.mockClear()
    ;(global.fetch as any) = vi.fn(async (url: string, opts: any) => {
      if (typeof url === "string" && url.includes("/api/buyers/import")) {
        const body = JSON.parse(opts.body)
        if (body.buyers) {
          const recs = body.buyers.map((r: any) => ({ id: `b${idCounter++}`, ...r }))
          buyers.push(...recs)
          return { ok: true, status: 200, json: async () => ({ insertedIds: recs.map((r: any) => r.id) }) }
        }
        if (body.updates) {
          const updatedIds: string[] = []
          for (const u of body.updates) {
            const idx = buyers.findIndex((b) => b.id === u.id)
            if (idx !== -1) {
              buyers[idx] = { ...buyers[idx], ...u.data }
              updatedIds.push(u.id)
            }
          }
          return { ok: true, status: 200, json: async () => ({ updatedIds }) }
        }
      }
      return { ok: true, status: 200, json: async () => ({}) }
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  test("inserts new buyers and assigns groups", async () => {
    const rows = [{ Email: "john@example.com", Tags: "VIP" }]
    const mapping = { email: "Email", tags: "Tags" }
    const result = await importBuyersFromCsv(rows, mapping, ["oldtag"], [], [], ["g1"])
    expect(result).toEqual({ inserted: 1, updated: 0, skipped: 0 })
    expect(buyers[0].email).toBe("john@example.com")
    expect(buyers[0].tags).toEqual(["VIP", "oldtag"])
    expect(buyerGroups).toEqual([{ buyer_id: buyers[0].id, group_id: "g1" }])
  })

  test("updates existing buyers and merges tags", async () => {
    buyers.push({ id: "b1", email: "jane@example.com", email_norm: "jane@example.com", tags: ["existing"] })
    const rows = [{ Email: "jane@example.com", Tags: "VIP" }]
    const mapping = { email: "Email", tags: "Tags" }
    const result = await importBuyersFromCsv(rows, mapping, ["oldtag"], [], [], ["g2"])
    expect(result).toEqual({ inserted: 0, updated: 1, skipped: 0 })
    expect(buyers[0].tags.sort()).toEqual(["existing", "VIP", "oldtag"].sort())
    expect(buyerGroups).toEqual([{ buyer_id: "b1", group_id: "g2" }])
  })
})
