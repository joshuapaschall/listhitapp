// PostgREST caps responses at 1,000 rows. Unpaged, an org with more than 1,000
// tags would show a truncated vocabulary and ensureTagsExist would re-create
// tags it simply couldn't see.

const state = vi.hoisted(() => ({
  pages: [] as Array<{ name: string }[]>,
  ranges: [] as Array<[number, number]>,
  inserts: [] as any[][],
}))

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== "tags") throw new Error(`Unexpected table ${table}`)
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              range: async (from: number, to: number) => {
                state.ranges.push([from, to])
                const pageIndex = Math.floor(from / 1000)
                return { data: state.pages[pageIndex] ?? [], error: null }
              },
            }),
          }),
        }),
        insert: (rows: any[]) => {
          state.inserts.push(rows)
          return { select: async () => ({ data: rows.map((r) => ({ name: r.name })), error: null }) }
        },
      }
    },
  },
}))

import { ensureTagsExist } from "@/lib/tags/ensure"

const ORG = "00000000-0000-4000-8000-00000000000a"

describe("ensureTagsExist paging", () => {
  beforeEach(() => {
    state.pages = []
    state.ranges = []
    state.inserts = []
  })

  test("sees a tag that only exists on the second page", async () => {
    // 1,000 tags on page 1, the one we care about on page 2.
    const firstPage = Array.from({ length: 1000 }, (_, i) => ({ name: `Tag ${i}` }))
    state.pages = [firstPage, [{ name: "Zebra Buyers" }]]

    const result = await ensureTagsExist(ORG, ["zebra buyers"])

    // Canonical casing from page 2 — and nothing created.
    expect(result).toEqual(["Zebra Buyers"])
    expect(state.inserts).toHaveLength(0)
    // It really did request a second page.
    expect(state.ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ])
  })

  test("stops after a short page", async () => {
    state.pages = [[{ name: "Only One" }]]

    await ensureTagsExist(ORG, ["only one"])

    expect(state.ranges).toEqual([[0, 999]])
  })

  test("still creates a genuinely new tag after walking every page", async () => {
    state.pages = [Array.from({ length: 1000 }, (_, i) => ({ name: `Tag ${i}` })), [{ name: "Last" }]]

    const result = await ensureTagsExist(ORG, ["Brand New"])

    expect(result).toEqual(["Brand New"])
    expect(state.inserts).toEqual([[{ org_id: ORG, name: "Brand New" }]])
  })
})
