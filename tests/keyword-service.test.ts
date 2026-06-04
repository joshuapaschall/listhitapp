import { KeywordService } from "../services/keyword-service"

// KeywordService now calls the org-scoped /api/negative-keywords endpoints
// (instead of the supabase client directly), so we mock fetch and back it with
// an in-memory store.
let keywords: any[] = []
let idCounter = 1

beforeEach(() => {
  keywords = []
  idCounter = 1
  // @ts-ignore
  global.fetch = vi.fn(async (url: string, opts: any = {}) => {
    const method = opts.method || "GET"
    const match = url.match(/\/api\/negative-keywords(?:\/([^/?]+))?/)
    const id = match?.[1]
    const reply = (data: any, ok = true, status = 200) => ({
      ok,
      status,
      json: async () => data,
    })

    if (!id) {
      if (method === "GET") return reply([...keywords])
      if (method === "POST") {
        const body = JSON.parse(opts.body)
        const record = {
          id: `k${idCounter++}`,
          keyword: body.keyword,
          match_type: body.matchType || "phrase",
          action: body.action || "hide",
          is_system: false,
        }
        keywords.push(record)
        return reply(record)
      }
    } else {
      const idx = keywords.findIndex((k) => k.id === id)
      if (method === "PATCH") {
        if (idx === -1) return reply({ error: "not found" }, false, 404)
        const body = JSON.parse(opts.body)
        if (body.keyword !== undefined) keywords[idx].keyword = body.keyword
        if (body.matchType) keywords[idx].match_type = body.matchType
        if (body.action) keywords[idx].action = body.action
        return reply(keywords[idx])
      }
      if (method === "DELETE") {
        if (idx !== -1) keywords.splice(idx, 1)
        return reply({ success: true })
      }
    }
    return reply({ error: "unhandled" }, false, 500)
  })
})

describe("KeywordService", () => {
  test("addKeyword inserts record", async () => {
    const kw = await KeywordService.addKeyword({ keyword: "spam", matchType: "phrase", action: "hide" })
    expect(kw.id).toBeDefined()
    expect(keywords.length).toBe(1)
  })

  test("listKeywords returns inserted records", async () => {
    await KeywordService.addKeyword({ keyword: "a", matchType: "phrase", action: "hide" })
    await KeywordService.addKeyword({ keyword: "b", matchType: "phrase", action: "hide" })
    const list = await KeywordService.listKeywords()
    expect(list.length).toBe(2)
  })

  test("getKeyword fetches by id", async () => {
    const kw = await KeywordService.addKeyword({ keyword: "a", matchType: "phrase", action: "hide" })
    const fetched = await KeywordService.getKeyword(kw.id)
    expect(fetched?.id).toBe(kw.id)
  })

  test("updateKeyword modifies record", async () => {
    const kw = await KeywordService.addKeyword({ keyword: "a", matchType: "phrase", action: "hide" })
    const updated = await KeywordService.updateKeyword(kw.id, { keyword: "c" })
    expect(updated.keyword).toBe("c")
  })

  test("deleteKeyword removes record", async () => {
    const kw = await KeywordService.addKeyword({ keyword: "a", matchType: "phrase", action: "hide" })
    await KeywordService.deleteKeyword(kw.id)
    expect(keywords.length).toBe(0)
  })
})
