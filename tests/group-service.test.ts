import { createGroup, updateGroup, deleteGroup } from "../lib/group-service"

let groups: any[] = []
let buyers: any[] = []
let buyerGroups: any[] = []
let idCounter = 1


vi.mock("../lib/supabase", () => {
  const client = {
    from: (table: string) => {
      if (table === "groups") {
        return {
          insert: (rows: any[]) => {
            const record = { id: String(idCounter++), ...rows[0] }
            groups.push(record)
            return {
              select: () => ({ data: [record], error: null }),
            }
          },
          update: (updates: any) => ({
            eq: (column: string, value: any) => {
              const group = groups.find((g) => g[column] === value)
              if (group) Object.assign(group, updates)
              return {
                select: () => ({ data: group ? [group] : [], error: null }),
              }
            },
          }),
          delete: () => ({
            eq: (column: string, value: any) => {
              groups = groups.filter((g) => g[column] !== value)
              return { error: null }
            },
          }),
          select: () => ({
            eq: (column: string, value: any) => ({
              single: async () => {
                const group = groups.find((g) => g[column] === value)
                return { data: group || null, error: null }
              },
            }),
          }),
        }
      }
      if (table === "buyer_groups") {
        return {
          select: () => ({
            eq: (column: string, value: any) =>
              Promise.resolve({
                data: buyerGroups.filter((bg) => bg[column] === value),
                error: null,
              }),
          }),
          delete: () => ({
            eq: (column: string, value: any) => {
              buyerGroups = buyerGroups.filter((bg) => bg[column] !== value)
              return Promise.resolve({ error: null })
            },
          }),
          insert: (rows: any[]) => {
            buyerGroups.push(...rows)
            return { error: null }
          },
        }
      }
      if (table === "buyers") {
        return {
          select: () => ({
            in: (column: string, values: any[]) =>
              Promise.resolve({
                data: buyers.filter((b) => values.includes(b[column])),
                error: null,
              }),
          }),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
  }
  return { supabase: client }
})


describe("group service", () => {
  beforeEach(() => {
    groups = []
    buyers = []
    buyerGroups = []
    idCounter = 1
    ;(global.fetch as any) = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 1 }),
    })
  })

  test("createGroup inserts Supabase group without SendFox calls", async () => {
    const group = await createGroup({ name: "Test Group" })
    expect(global.fetch).not.toHaveBeenCalled()
    expect(group.name).toBe("Test Group")
    expect(groups[0].sendfox_list_id).toBeUndefined()
  })

  test("updateGroup updates Supabase group without SendFox member sync", async () => {
    groups = [{ id: "1", name: "G", sendfox_list_id: 1, created_at: "", updated_at: "" }]
    buyers = [
      { id: "b1", email: "a@example.com", fname: "A", lname: "A" },
      { id: "b2", email: "b@example.com", fname: "B", lname: "B" },
    ]
    buyerGroups = [
      { buyer_id: "b1", group_id: "1" },
      { buyer_id: "b2", group_id: "1" },
    ]

    const group = await updateGroup("1", { name: "G2" })
    expect(group.name).toBe("G2")
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test("deleteGroup removes Supabase group and memberships without SendFox calls", async () => {
    groups = [{ id: "1", name: "G", sendfox_list_id: 1, created_at: "", updated_at: "" }]
    buyerGroups = [{ buyer_id: "b1", group_id: "1" }]
    await deleteGroup("1")
    expect(global.fetch).not.toHaveBeenCalled()
    expect(groups.length).toBe(0)
    expect(buyerGroups.length).toBe(0)
  })
})
