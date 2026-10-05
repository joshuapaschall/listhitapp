// ensureTagsExist is the single gate that keeps an org's tag vocabulary
// complete. Tags are stored on records by NAME, so a name that never reached
// public.tags is invisible to every picker, filter and the settings page.

const state = vi.hoisted(() => ({
  existing: [] as Array<{ name: string }>,
  inserts: [] as any[][],
  insertError: null as any,
  // Rows visible on the post-conflict re-select.
  afterRace: null as Array<{ name: string }> | null,
  selectCount: 0,
}))

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== "tags") throw new Error(`Unexpected table ${table}`)
      return {
        select: () => ({
          eq: async () => {
            state.selectCount += 1
            const rows =
              state.selectCount > 1 && state.afterRace ? state.afterRace : state.existing
            return { data: rows, error: null }
          },
        }),
        insert: (rows: any[]) => {
          state.inserts.push(rows)
          return {
            select: async () => ({
              data: state.insertError ? null : rows.map((r) => ({ name: r.name })),
              error: state.insertError,
            }),
          }
        },
      }
    },
  },
}))

import { ensureTagsExist } from "@/lib/tags/ensure"

const ORG = "00000000-0000-4000-8000-00000000000a"

describe("ensureTagsExist", () => {
  beforeEach(() => {
    state.existing = []
    state.inserts = []
    state.insertError = null
    state.afterRace = null
    state.selectCount = 0
  })

  test("a case-insensitive match returns the EXISTING casing", async () => {
    state.existing = [{ name: "Atlanta Closers" }]

    const result = await ensureTagsExist(ORG, ["atlanta closers"])

    expect(result).toEqual(["Atlanta Closers"])
    // Nothing created — this is the whole point.
    expect(state.inserts).toHaveLength(0)
  })

  test("new names are inserted with the org", async () => {
    state.existing = [{ name: "Investor" }]

    const result = await ensureTagsExist(ORG, ["Investor", "Brand New"])

    expect(result).toEqual(["Investor", "Brand New"])
    expect(state.inserts).toEqual([[{ org_id: ORG, name: "Brand New" }]])
  })

  test("empties, whitespace and case-duplicates are dropped", async () => {
    const result = await ensureTagsExist(ORG, ["  Keep  ", "", "   ", "keep", "KEEP"])

    expect(result).toEqual(["Keep"])
    expect(state.inserts).toEqual([[{ org_id: ORG, name: "Keep" }]])
  })

  test("input order is preserved", async () => {
    state.existing = [{ name: "Zed" }, { name: "Alpha" }]

    const result = await ensureTagsExist(ORG, ["Zed", "New One", "Alpha"])

    expect(result).toEqual(["Zed", "New One", "Alpha"])
  })

  test("a 23505 race re-selects and returns the winner's casing", async () => {
    state.insertError = { code: "23505", message: "duplicate key" }
    state.afterRace = [{ name: "Raced Name" }]

    const result = await ensureTagsExist(ORG, ["raced name"])

    expect(result).toEqual(["Raced Name"])
  })

  test("a non-23505 insert error is thrown", async () => {
    state.insertError = { code: "42501", message: "denied" }
    const err = vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(ensureTagsExist(ORG, ["Nope"])).rejects.toMatchObject({ code: "42501" })
    err.mockRestore()
  })

  test("an empty input list short-circuits without touching the DB", async () => {
    expect(await ensureTagsExist(ORG, [])).toEqual([])
    expect(state.selectCount).toBe(0)
  })

  test("non-string entries are ignored", async () => {
    const result = await ensureTagsExist(ORG, ["Good", null as any, 42 as any])
    expect(result).toEqual(["Good"])
  })
})
