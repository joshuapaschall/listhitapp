import { describe, expect, test, beforeEach } from "@jest/globals"
import { toast } from "sonner"
import { createGroup, updateGroup, deleteGroup } from "../lib/group-service"

let groups: any[] = []
let buyers: any[] = []
let buyerGroups: any[] = []
let idCounter = 1

jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }))

jest.mock("../lib/supabase", () => {
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
    ;(global.fetch as any) = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 1 }),
    })
    ;(toast.error as jest.Mock).mockClear()
  })

  test("createGroup creates SendFox list and stores id", async () => {
    const group = await createGroup({ name: "Test Group" })
    expect(global.fetch).toHaveBeenCalledWith("/api/sendfox/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Group" }),
    })
    expect(group.sendfox_list_id).toBe(1)
    expect(groups[0].sendfox_list_id).toBe(1)
  })

  test("updateGroup resyncs members to SendFox", async () => {
    groups = [{ id: "1", name: "G", sendfox_list_id: 1, created_at: "", updated_at: "" }]
    buyers = [
      { id: "b1", email: "a@example.com", fname: "A", lname: "A" },
      { id: "b2", email: "b@example.com", fname: "B", lname: "B" },
    ]
    buyerGroups = [
      { buyer_id: "b1", group_id: "1" },
      { buyer_id: "b2", group_id: "1" },
    ]

    await updateGroup("1", { name: "G2" })
    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "/api/sendfox/lists/1/contacts",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "a@example.com",
          first_name: "A",
          last_name: "A",
        }),
      },
    )
  })

  test("deleteGroup can remove SendFox list", async () => {
    groups = [{ id: "1", name: "G", sendfox_list_id: 1, created_at: "", updated_at: "" }]
    buyerGroups = [{ buyer_id: "b1", group_id: "1" }]
    await deleteGroup("1", true)
    expect(global.fetch).toHaveBeenCalledWith("/api/sendfox/lists/1", {
      method: "DELETE",
    })
    expect(groups.length).toBe(0)
    expect(buyerGroups.length).toBe(0)
  })

  test("shows toast on SendFox sync failure", async () => {
    ;(global.fetch as any).mockRejectedValueOnce(new Error("fail"))
    const group = await createGroup({ name: "Bad" })
    expect(group.sendfox_list_id).toBeNull()
    expect(toast.error).toHaveBeenCalled()
  })
})
