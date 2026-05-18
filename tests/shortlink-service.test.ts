import { beforeEach, describe, expect, test, vi } from "vitest"

interface FakeRow {
  id: string
  slug: string
  domain: string
  target_url: string
}

// In-memory state controlled by individual tests.
let nextInsertBehavior: {
  // For single-row insert (.select().single())
  single?: () => Promise<{ data: FakeRow | null; error: unknown }>
  // For bulk insert (.select() without .single())
  bulk?: () => Promise<{ data: FakeRow[] | null; error: unknown }>
} = {}
let insertCount = 0
let bulkInsertCount = 0

vi.mock("../lib/supabase", () => {
  const client = {
    from: (_table: string) => ({
      insert: (rows: unknown) => {
        const isArray = Array.isArray(rows)
        if (isArray) bulkInsertCount += 1
        else insertCount += 1
        return {
          select: (_cols: string) => ({
            single: async () => {
              if (!nextInsertBehavior.single) {
                throw new Error("nextInsertBehavior.single not configured for this test")
              }
              return nextInsertBehavior.single()
            },
            // bulk path: insert(rows).select() returns thenable resolving to result
            then: (
              resolve: (val: { data: FakeRow[] | null; error: unknown }) => void,
              reject?: (err: unknown) => void,
            ) => {
              if (!nextInsertBehavior.bulk) {
                if (reject) reject(new Error("nextInsertBehavior.bulk not configured for this test"))
                return
              }
              nextInsertBehavior.bulk().then(resolve).catch(reject || (() => {}))
            },
          }),
        }
      },
    }),
  }
  return { supabase: client }
})

beforeEach(() => {
  process.env.SHORT_LINK_DEFAULT_DOMAIN = "go.example.com"
  nextInsertBehavior = {}
  insertCount = 0
  bulkInsertCount = 0
})

async function importService() {
  vi.resetModules()
  return await import("../services/shortlink-service")
}

describe("generateSlug", () => {
  test("returns a 7-char string composed only of the allowed alphabet", async () => {
    const { generateSlug } = await importService()
    const slug = generateSlug()
    expect(slug).toHaveLength(7)
    expect(slug).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{7}$/)
  })
})

describe("createShortLink", () => {
  test("returns the expected shape on success", async () => {
    const { createShortLink } = await importService()
    nextInsertBehavior.single = async () => ({
      data: {
        id: "row-1",
        slug: "Abc23xy",
        domain: "go.example.com",
        target_url: "https://example.com/target",
      },
      error: null,
    })

    const result = await createShortLink({ targetUrl: "https://example.com/target" })
    expect(result).toEqual({
      id: "row-1",
      slug: "Abc23xy",
      domain: "go.example.com",
      shortUrl: "https://go.example.com/Abc23xy",
      targetUrl: "https://example.com/target",
    })
    expect(insertCount).toBe(1)
  })

  test("retries on 23505 collision when no custom slug provided", async () => {
    const { createShortLink } = await importService()
    let calls = 0
    nextInsertBehavior.single = async () => {
      calls += 1
      if (calls < 3) {
        return { data: null, error: { code: "23505", message: "dup" } }
      }
      return {
        data: {
          id: "row-1",
          slug: "ABCxyz9",
          domain: "go.example.com",
          target_url: "https://x.test",
        },
        error: null,
      }
    }
    const result = await createShortLink({ targetUrl: "https://x.test" })
    expect(result.slug).toBe("ABCxyz9")
    expect(calls).toBe(3)
  })

  test("throws immediately on 23505 collision when a custom slug IS provided", async () => {
    const { createShortLink } = await importService()
    let calls = 0
    nextInsertBehavior.single = async () => {
      calls += 1
      return { data: null, error: { code: "23505", message: "dup" } }
    }
    await expect(
      createShortLink({ targetUrl: "https://x.test", slug: "MYSLUG1" }),
    ).rejects.toMatchObject({ code: "23505" })
    expect(calls).toBe(1)
  })
})

describe("createShortLinksBulk", () => {
  test("returns results in input order on success", async () => {
    const { createShortLinksBulk } = await importService()
    nextInsertBehavior.bulk = async () => ({
      data: [
        { id: "r1", slug: "AAAA111", domain: "go.example.com", target_url: "https://a.test" },
        { id: "r2", slug: "BBBB222", domain: "go.example.com", target_url: "https://b.test" },
      ],
      error: null,
    })

    const results = await createShortLinksBulk([
      { targetUrl: "https://a.test" },
      { targetUrl: "https://b.test" },
    ])
    expect(results).toHaveLength(2)
    expect(results[0]?.slug).toBe("AAAA111")
    expect(results[1]?.slug).toBe("BBBB222")
    expect(results[0]?.shortUrl).toBe("https://go.example.com/AAAA111")
    expect(bulkInsertCount).toBe(1)
  })

  test("falls back to individual creates after 3 batch collisions", async () => {
    const { createShortLinksBulk } = await importService()
    let bulkAttempts = 0
    nextInsertBehavior.bulk = async () => {
      bulkAttempts += 1
      return { data: null, error: { code: "23505", message: "dup" } }
    }
    // Each individual createShortLink call goes through .single() path
    let singleCalls = 0
    nextInsertBehavior.single = async () => {
      singleCalls += 1
      return {
        data: {
          id: `r${singleCalls}`,
          slug: `Slug${singleCalls}xx`,
          domain: "go.example.com",
          target_url: `https://t${singleCalls}.test`,
        },
        error: null,
      }
    }

    const results = await createShortLinksBulk([
      { targetUrl: "https://t1.test" },
      { targetUrl: "https://t2.test" },
    ])
    expect(bulkAttempts).toBe(3)
    expect(results).toHaveLength(2)
    expect(results[0]?.targetUrl).toBe("https://t1.test")
    expect(results[1]?.targetUrl).toBe("https://t2.test")
  })

  test("returns null entries for fallback creates that fail", async () => {
    const { createShortLinksBulk } = await importService()
    nextInsertBehavior.bulk = async () => ({
      data: null,
      error: { code: "23505", message: "dup" },
    })
    // All single inserts fail with a non-collision error
    nextInsertBehavior.single = async () => ({
      data: null,
      error: { code: "23502", message: "not null violation" },
    })

    const results = await createShortLinksBulk([{ targetUrl: "https://fail.test" }])
    expect(results).toEqual([null])
  })
})
