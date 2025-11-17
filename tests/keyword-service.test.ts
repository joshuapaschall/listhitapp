import { describe, expect, test, beforeEach } from "@jest/globals"
import { KeywordService } from "../services/keyword-service"

let keywords: any[] = []
let idCounter = 1

jest.mock("../lib/supabase", () => {
  const client = {
      from: (table: string) => {
        if (table !== "negative_keywords") throw new Error(`Unexpected table ${table}`)
        return {
          insert: (rows: any[]) => {
            const record = { id: `k${idCounter++}`, ...rows[0] }
            keywords.push(record)
            return {
              select: () => ({ single: async () => ({ data: record, error: null }) })
            }
          },
          select: () => {
            let result = [...keywords]
            const query: any = {
              eq: (col: string, val: any) => {
                result = result.filter(k => k[col] === val)
                return query
              },
              order: () => query,
              maybeSingle: async () => ({ data: result[0] || null, error: null }),
              single: async () => ({ data: result[0], error: null }),
              then: async (resolve: any) => resolve({ data: result, error: null })
            }
            return query
          },
          update: (updates: any) => ({
            eq: (col: string, val: any) => ({
              select: () => ({
                single: async () => {
                  const idx = keywords.findIndex(k => k[col] === val)
                  if (idx !== -1) {
                    keywords[idx] = { ...keywords[idx], ...updates }
                    return { data: keywords[idx], error: null }
                  }
                  return { data: null, error: null }
                }
              })
            })
          }),
          delete: () => ({
            eq: async (col: string, val: any) => {
              const idx = keywords.findIndex(k => k[col] === val)
              if (idx !== -1) keywords.splice(idx, 1)
              return { error: null }
            }
          })
        }
      }
    }
  return { supabase: client, supabaseAdmin: client }
})

describe("KeywordService", () => {
  beforeEach(() => {
    keywords = []
    idCounter = 1
  })

  test("addKeyword inserts record", async () => {
    const kw = await KeywordService.addKeyword({ keyword: "spam" })
    expect(kw.id).toBeDefined()
    expect(keywords.length).toBe(1)
  })

  test("listKeywords returns inserted records", async () => {
    await KeywordService.addKeyword({ keyword: "a" })
    await KeywordService.addKeyword({ keyword: "b" })
    const list = await KeywordService.listKeywords()
    expect(list.length).toBe(2)
  })

  test("getKeyword fetches by id", async () => {
    const kw = await KeywordService.addKeyword({ keyword: "a" })
    const fetched = await KeywordService.getKeyword(kw.id)
    expect(fetched?.id).toBe(kw.id)
  })

  test("updateKeyword modifies record", async () => {
    const kw = await KeywordService.addKeyword({ keyword: "a" })
    const updated = await KeywordService.updateKeyword(kw.id, { keyword: "c" })
    expect(updated.keyword).toBe("c")
  })

  test("deleteKeyword removes record", async () => {
    const kw = await KeywordService.addKeyword({ keyword: "a" })
    await KeywordService.deleteKeyword(kw.id)
    expect(keywords.length).toBe(0)
  })
})

