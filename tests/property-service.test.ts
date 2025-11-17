import { describe, expect, test, beforeEach } from "@jest/globals"
import { PropertyService } from "../services/property-service"

const shortMock = jest.fn()

// Mock implementation of the Supabase client
let properties: any[] = []
let idCounter = 1

const fetchMock = jest.fn()
global.fetch = fetchMock as any

jest.mock("../lib/supabase", () => {
  const client = {
      from: (table: string) => {
        if (table !== "properties") throw new Error(`Unexpected table ${table}`)

        return {
          insert: (rows: any[]) => {
            const record = { id: String(idCounter++), ...rows[0] }
            properties.push(record)
            return {
              select: () => ({
                single: async () => ({ data: record, error: null }),
                maybeSingle: async () => ({ data: record, error: null }),
              }),
            }
          },

          select: (_cols?: any, opts: any = {}) => {
            let result = [...properties]
            let countResult = [...properties]
            const query: any = {
              eq: (column: string, value: any) => {
                result = result.filter((p) => p[column] === value)
                countResult = countResult.filter((p) => p[column] === value)
                return query
              },
              ilike: (column: string, pattern: string) => {
                const val = pattern.replace(/%/g, "").toLowerCase()
                result = result.filter((p) =>
                  (p[column] || "").toLowerCase().includes(val),
                )
                countResult = countResult.filter((p) =>
                  (p[column] || "").toLowerCase().includes(val),
                )
                return query
              },
              gte: (column: string, value: number) => {
                result = result.filter((p) => (p[column] || 0) >= value)
                countResult = countResult.filter((p) => (p[column] || 0) >= value)
                return query
              },
              lte: (column: string, value: number) => {
                result = result.filter((p) => (p[column] || 0) <= value)
                countResult = countResult.filter((p) => (p[column] || 0) <= value)
                return query
              },
              or: (expr: string) => {
                const match = expr.match(/ilike\.%(.*?)%/)
                const val = match ? match[1].toLowerCase() : ""
                const filterFn = (p: any) =>
                  ["address", "city", "state", "zip"].some((c) =>
                    (p[c] || "").toLowerCase().includes(val),
                  )
                result = result.filter(filterFn)
                countResult = countResult.filter(filterFn)
                return query
              },
              order: (column: string, options: any = {}) => {
                const asc = options.ascending !== false
                const sorter = (a: any, b: any) => {
                  if (a[column] === b[column]) return 0
                  return asc
                    ? a[column] > b[column]
                      ? 1
                      : -1
                    : a[column] < b[column]
                      ? 1
                      : -1
                }
                result.sort(sorter)
                countResult.sort(sorter)
                return query
              },
              range: (from: number, to: number) => {
                result = result.slice(from, to + 1)
                return query
              },
              limit: (n: number) => {
                result = result.slice(0, n)
                return query
              },
              then: async (resolve: any) =>
                resolve({
                  data: result,
                  error: null,
                  count: opts.count ? countResult.length : null,
                }),
              single: async () => ({ data: result[0] || null, error: null }),
              maybeSingle: async () =>
                result[0]
                  ? { data: result[0], error: null }
                  : { data: null, error: { message: "Row not found" } },
            }
            return query
          },

          update: (updates: any) => ({
            eq: (column: string, value: any) => ({
              select: () => ({
                single: async () => {
                  const idx = properties.findIndex((p) => p[column] === value)
                  if (idx === -1) return { data: null, error: null }
                  properties[idx] = { ...properties[idx], ...updates }
                  return { data: properties[idx], error: null }
                },
              }),
            }),
          }),

          delete: () => ({
            eq: async (column: string, value: any) => {
              const idx = properties.findIndex((p) => p[column] === value)
              if (idx !== -1) properties.splice(idx, 1)
              return { error: null }
            },
          }),
        }
      },
    }
  return { supabase: client, supabaseAdmin: client }
})

jest.mock("../services/shortio-service", () => ({
  createShortLink: (...args: any[]) => shortMock(...args),
}))

describe("PropertyService", () => {
  beforeEach(() => {
    properties = []
    idCounter = 1
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ latitude: 10, longitude: 20 }),
    })
    shortMock.mockReset()
  })

  test("addProperty inserts correctly", async () => {
    const prop = await PropertyService.addProperty({
      address: "123 Main St",
      status: "available",
    })
    expect(prop.id).toBeDefined()
    expect(prop.address).toBe("123 Main St")
    expect(prop.latitude).toBe(10)
    expect(prop.longitude).toBe(20)
  })

  test("getProperty retrieves the same record", async () => {
    const inserted = await PropertyService.addProperty({ address: "1", status: "a" })
    const fetched = await PropertyService.getProperty(inserted.id)
    expect(fetched).toEqual(inserted)
  })

  test("getProperty returns null when no record exists", async () => {
    const fetched = await PropertyService.getProperty("999")
    expect(fetched).toBeNull()
  })

  test("updateProperty updates existing record", async () => {
    const inserted = await PropertyService.addProperty({ address: "2", status: "a" })
    const updated = await PropertyService.updateProperty(inserted.id, { status: "sold" })
    expect(updated.status).toBe("sold")
    const fetched = await PropertyService.getProperty(inserted.id)
    expect(fetched?.status).toBe("sold")
  })

  test("updateProperty geocodes when updating address", async () => {
    const inserted = await PropertyService.addProperty({ address: "old", status: "a" })
    const updated = await PropertyService.updateProperty(inserted.id, { address: "new" })
    expect(updated.latitude).toBe(10)
    expect(updated.longitude).toBe(20)
  })

  test("deleteProperty removes record", async () => {
    const inserted = await PropertyService.addProperty({ address: "3", status: "a" })
    await PropertyService.deleteProperty(inserted.id)
    const fetched = await PropertyService.getProperty(inserted.id)
    expect(fetched).toBeNull()
  })

  test("findByAddress returns property by address", async () => {
    const inserted = await PropertyService.addProperty({
      address: "4 Main",
      city: "Austin",
      zip: "78701",
      status: "a",
    })
    const fetched = await PropertyService.findByAddress("4 Main", "Austin", "78701")
    expect(fetched).toEqual(inserted)
  })

  test("findByAddress fuzzy matches", async () => {
    const inserted = await PropertyService.addProperty({
      address: "500 West Street",
      city: "Dallas",
      zip: "75201",
      status: "a",
    })
    const fetched = await PropertyService.findByAddress("500 West", "Dal", "752")
    expect(fetched).toEqual(inserted)
  })

  test("findByAddress returns null when not found", async () => {
    const fetched = await PropertyService.findByAddress("does not exist")
    expect(fetched).toBeNull()
  })

  test("getProperties filters by status", async () => {
    await PropertyService.addProperty({ address: "a", status: "available" })
    await PropertyService.addProperty({ address: "b", status: "sold" })

    const result = await PropertyService.getProperties({ status: "available" })

    expect(result.totalCount).toBe(1)
    expect(result.properties[0].status).toBe("available")
  })

  test("getProperties supports search and pagination", async () => {
    await PropertyService.addProperty({ address: "123 Main", city: "Austin", status: "available", price: 100 })
    await PropertyService.addProperty({ address: "456 Oak", city: "Dallas", status: "available", price: 200 })
    await PropertyService.addProperty({ address: "789 Pine", city: "Austin", status: "available", price: 300 })

    const page1 = await PropertyService.getProperties({
      search: "Austin",
      page: 1,
      pageSize: 1,
      sortBy: "price",
      sortOrder: "asc",
    })

    expect(page1.totalCount).toBe(2)
    expect(page1.properties.length).toBe(1)
    expect(page1.properties[0].city).toBe("Austin")

    const page2 = await PropertyService.getProperties({
      search: "Austin",
      page: 2,
      pageSize: 1,
      sortBy: "price",
      sortOrder: "asc",
    })

    expect(page2.properties[0].price).toBe(300)
  })

  test("getProperties supports additional filters", async () => {
    await PropertyService.addProperty({
      address: "filter1",
      status: "available",
      property_type: "SFH",
      bedrooms: 3,
      bathrooms: 2,
    })
    await PropertyService.addProperty({
      address: "filter2",
      status: "available",
      property_type: "Multi",
      bedrooms: 5,
      bathrooms: 4,
    })

    const result = await PropertyService.getProperties({
      propertyType: "SFH",
      minBedrooms: 2,
      maxBathrooms: 2,
    })

    expect(result.totalCount).toBe(1)
    expect(result.properties[0].address).toBe("filter1")
  })

  test("addProperty generates short link", async () => {
    shortMock.mockResolvedValue({
      shortURL: "http://s.io/a",
      path: "myslug",
      idString: "id1",
    })
    const prop = await PropertyService.addProperty({
      address: "sl",
      status: "a",
      website_url: "https://example.com/listing",
      short_slug: "myslug",
    })
    expect(shortMock).toHaveBeenCalledWith(
      "https://example.com/listing",
      "myslug",
    )
    expect(prop.short_url_key).toBe("myslug")
    expect(prop.short_url).toBe("http://s.io/a")
    expect(prop.short_slug).toBe("myslug")
    expect(prop.shortio_link_id).toBe("id1")
    const fetched = await PropertyService.getProperty(prop.id)
    expect(fetched?.short_url_key).toBe("myslug")
    expect(fetched?.short_url).toBe("http://s.io/a")
    expect(fetched?.short_slug).toBe("myslug")
    expect(fetched?.shortio_link_id).toBe("id1")
  })
})
