import { describe, expect, test, beforeEach, jest } from "@jest/globals"
let buyers: any[] = []
let idCounter = 1
const fetchMock = jest.fn()

jest.mock("../lib/supabase", () => {
  const client = {
    from: (table: string) => {
      if (table !== "buyers") throw new Error(`Unexpected table ${table}`)

      return {
        insert: (rows: any[]) => {
          const record = { id: String(idCounter++), sendfox_hidden: false, ...rows[0] }
          buyers.push(record)
          return {
            select: () => ({ single: async () => ({ data: record, error: null }) })
          }
        },

        select: () => {
          let result = [...buyers]
          const query: any = {
            or: (expr: string) => {
              const match = expr.match(/ilike\.%(.*?)%/)
              const val = match ? match[1].toLowerCase() : ""
              const filterFn = (b: any) =>
                ["fname", "lname", "full_name", "email", "phone"].some((c) =>
                  (b[c] || "").toLowerCase().includes(val)
                )
              result = result.filter(filterFn)
              return query
            },
            eq: (column: string, value: any) => {
              result = result.filter((r: any) => r[column] === value)
              return query
            },
            order: (column: string, options: any = {}) => {
              const asc = options.ascending !== false
              result.sort((a: any, b: any) => {
                if (a[column] === b[column]) return 0
                return asc ? (a[column] > b[column] ? 1 : -1) : (a[column] < b[column] ? 1 : -1)
              })
              return query
            },
            limit: (n: number) => {
              result = result.slice(0, n)
              return query
            },
            then: async (resolve: any) => resolve({ data: result, error: null })
          }
          return query
        }
      }
    }
  }
  return { supabase: client, supabaseAdmin: client }
})


const { BuyerService } = require("../services/buyer-service")

describe("BuyerService.searchBuyers", () => {
  beforeEach(() => {
    buyers = []
    idCounter = 1
    fetchMock.mockReset().mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 1 }) })
    ;(global as any).fetch = fetchMock
  })

  test("returns matching buyers", async () => {
    await BuyerService.addBuyer({ full_name: "John Doe", fname: "John", lname: "Doe", email: "john@example.com", phone: "555-1111" })
    await BuyerService.addBuyer({ full_name: "Jane Smith", fname: "Jane", lname: "Smith", email: "jane@example.com", phone: "555-2222" })

    const results = await BuyerService.searchBuyers("Jane Smith")

    expect(results.length).toBe(1)
    expect(results[0].full_name).toBe("Jane Smith")
  })

  test("limits results to 20", async () => {
    for (let i = 0; i < 25; i++) {
      await BuyerService.addBuyer({ fname: `Buyer${i}`, lname: "Test", email: `b${i}@example.com`, phone: "555-0000" })
    }

    const results = await BuyerService.searchBuyers("buyer")
    expect(results.length).toBe(20)
  })
})

describe("BuyerService.listBuyers", () => {
  beforeEach(() => {
    buyers = []
    idCounter = 1
    fetchMock.mockReset().mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 1 }) })
    ;(global as any).fetch = fetchMock
  })

  test("returns some buyers", async () => {
    await BuyerService.addBuyer({ fname: "Charlie", lname: "Zed" })
    await BuyerService.addBuyer({ fname: "Alice", lname: "Baker" })

    const results = await BuyerService.listBuyers(10)
    expect(results.length).toBe(2)
  })

  test("limits results", async () => {
    for (let i = 0; i < 30; i++) {
      await BuyerService.addBuyer({ fname: `Buyer${i}` })
    }

    const results = await BuyerService.listBuyers(15)
    expect(results.length).toBe(15)
  })
})

describe("BuyerService.addBuyer", () => {
  beforeEach(() => {
    buyers = []
    idCounter = 1
    fetchMock.mockReset().mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 1 }) })
    ;(global as any).fetch = fetchMock
    delete process.env.SENDFOX_DEFAULT_LIST_ID
  })

  test("adds contact to default SendFox list", async () => {
    process.env.SENDFOX_DEFAULT_LIST_ID = "1"
    await BuyerService.addBuyer({ email: "test@example.com" })
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sendfox/contact",
      expect.objectContaining({ method: "POST" }),
    )
    const sent = JSON.parse((fetchMock.mock.calls[0][1] as any).body)
    expect(sent).toEqual({ email: "test@example.com", lists: [1] })
  })

  test("re-adding buyer overwrites lists", async () => {
    process.env.SENDFOX_DEFAULT_LIST_ID = "1"
    await BuyerService.addBuyer({ email: "test@example.com" })
    process.env.SENDFOX_DEFAULT_LIST_ID = "2"
    await BuyerService.addBuyer({ email: "test@example.com" })
    const bodies = fetchMock.mock.calls.map((c: any) => JSON.parse(c[1].body))
    expect(bodies[0]).toEqual({ email: "test@example.com", lists: [1] })
    expect(bodies[1]).toEqual({ email: "test@example.com", lists: [2] })
  })
})
