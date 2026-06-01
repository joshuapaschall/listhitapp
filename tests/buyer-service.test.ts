import { BuyerService } from "../services/buyer-service"

let buyers: any[] = []
let idCounter = 1
const fetchMock = vi.fn()

vi.mock("../lib/supabase", () => {
  const client = {
    from: (table: string) => {
      if (table !== "buyers") throw new Error(`Unexpected table ${table}`)

      return {
        insert: (rows: any[]) => {
          const record = { id: String(idCounter++), deleted_at: null, ...rows[0] }
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
            is: (column: string, value: any) => {
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
  })

  test("adds buyer in Supabase without SendFox contact sync", async () => {
    const buyer = await BuyerService.addBuyer({ email: "test@example.com" })
    expect(buyer.email).toBe("test@example.com")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("re-adding buyer does not call SendFox", async () => {
    await BuyerService.addBuyer({ email: "test@example.com" })
    await BuyerService.addBuyer({ email: "test@example.com" })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
