// short_links.org_id has no default for the service-role client, so a
// server-side create must name its tenant or the row lands with a NULL org.

const state = vi.hoisted(() => ({
  singleRows: [] as any[],
  bulkRows: [] as any[][],
}))

vi.mock("../lib/supabase", () => ({
  supabaseAdmin: {
    from: (_table: string) => ({
      insert: (rows: any) => {
        const isArray = Array.isArray(rows)
        if (isArray) state.bulkRows.push(rows)
        else state.singleRows.push(rows)
        const made = (row: any, i: number) => ({
          id: `id${i}`,
          slug: row.slug,
          domain: row.domain,
          target_url: row.target_url,
        })
        return {
          select: (_cols: string) => ({
            single: async () => ({ data: made(rows, 0), error: null }),
            then: (resolve: any) =>
              resolve({ data: (rows as any[]).map(made), error: null }),
          }),
        }
      },
    }),
  },
}))

import { createShortLink, createShortLinksBulk } from "../services/shortlink-service"

const ORG_A = "00000000-0000-4000-8000-00000000000a"
const ORG_B = "00000000-0000-4000-8000-00000000000b"

describe("short link org stamping", () => {
  beforeEach(() => {
    state.singleRows = []
    state.bulkRows = []
    process.env.SHORT_LINK_DEFAULT_DOMAIN = "go.example.com"
  })

  test("a server-side create without orgId throws", async () => {
    await expect(createShortLink({ targetUrl: "https://example.com" })).rejects.toThrow(
      "orgId required",
    )
    expect(state.singleRows).toHaveLength(0)
  })

  test("a server-side create with orgId writes org_id", async () => {
    const result = await createShortLink({
      targetUrl: "https://example.com",
      orgId: ORG_A,
    })

    expect(result.shortUrl).toBe(`https://go.example.com/${result.slug}`)
    expect(state.singleRows).toHaveLength(1)
    expect(state.singleRows[0]).toEqual(expect.objectContaining({ org_id: ORG_A }))
  })

  test("bulk requires orgId on every input", async () => {
    await expect(
      createShortLinksBulk([
        { targetUrl: "https://a.test", orgId: ORG_A },
        { targetUrl: "https://b.test" },
      ]),
    ).rejects.toThrow("orgId required")
    expect(state.bulkRows).toHaveLength(0)
  })

  test("bulk writes org_id per row, not one org for the batch", async () => {
    const results = await createShortLinksBulk([
      { targetUrl: "https://a.test", orgId: ORG_A },
      { targetUrl: "https://b.test", orgId: ORG_B },
    ])

    expect(results).toHaveLength(2)
    expect(state.bulkRows).toHaveLength(1)
    expect(state.bulkRows[0][0]).toEqual(expect.objectContaining({ org_id: ORG_A }))
    expect(state.bulkRows[0][1]).toEqual(expect.objectContaining({ org_id: ORG_B }))
  })
})
