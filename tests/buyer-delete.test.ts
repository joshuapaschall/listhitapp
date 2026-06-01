import { BuyerService } from "../services/buyer-service"

let buyers: any[] = []
let buyerGroups: any[] = []
let groups: any[] = []

const fetchMock = vi.fn()
global.fetch = fetchMock as any

vi.mock("../lib/supabase", () => {
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


describe("BuyerService deletions", () => {
  beforeEach(() => {
    buyers = [
      { id: "1", email: "a@test.com", fname: "A", deleted_at: null },
      { id: "2", email: "b@test.com", fname: "B", deleted_at: null },
    ]
    buyerGroups = []
    groups = []
    fetchMock.mockReset().mockResolvedValue({ ok: true })
  })

  test("deleteBuyer soft-deletes buyer and removes group links without SendFox", async () => {
    buyerGroups.push({ buyer_id: "1", group_id: "g1" })
    await BuyerService.deleteBuyer("1")
    const b = buyers.find((b) => b.id === "1")
    expect(b?.deleted_at).toEqual(expect.any(String))
    expect(buyerGroups.length).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("deleteBuyers handles multiple ids", async () => {
    await BuyerService.deleteBuyers(["1", "2"])
    expect(buyers.every((b) => typeof b.deleted_at === "string")).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
