import { describe, expect, test, beforeEach } from "@jest/globals"
import { PromptService } from "../services/prompt-service"

let prompts: any[] = []
let idCounter = 1

jest.mock("../lib/supabase", () => {
  const client = {
      from: (table: string) => {
        if (table !== "ai_prompts") throw new Error(`Unexpected table ${table}`)

        return {
          insert: (rows: any[]) => {
            const record = { id: `p${idCounter++}`, ...rows[0] }
            prompts.push(record)
            return {
              select: () => ({ single: async () => ({ data: record, error: null }) })
            }
          },
          select: () => {
            let result = [...prompts]
            const query: any = {
              order: (_col: string, opts: any) => {
                if (opts.ascending === false) result.reverse()
                return query
              },
              eq: (col: string, val: any) => {
                result = result.filter(p => p[col] === val)
                return query
              },
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
                  const idx = prompts.findIndex(p => p[col] === val)
                  if (idx !== -1) {
                    prompts[idx] = { ...prompts[idx], ...updates }
                    return { data: prompts[idx], error: null }
                  }
                  return { data: null, error: null }
                }
              })
            })
          }),
          delete: () => ({
            eq: async (col: string, val: any) => {
              const idx = prompts.findIndex(p => p[col] === val)
              if (idx !== -1) prompts.splice(idx, 1)
              return { error: null }
            }
          })
        }
      }
    }
  return { supabase: client, supabaseAdmin: client }
})

describe("PromptService", () => {
  beforeEach(() => {
    prompts = []
    idCounter = 1
  })

  test("addPrompt inserts record", async () => {
    const p = await PromptService.addPrompt({ name: "Hello", prompt: "Hi" })
    expect(p.id).toBeDefined()
    expect(prompts.length).toBe(1)
  })

  test("listPrompts returns inserted records", async () => {
    await PromptService.addPrompt({ name: "A", prompt: "a" })
    await PromptService.addPrompt({ name: "B", prompt: "b" })
    const list = await PromptService.listPrompts()
    expect(list.length).toBe(2)
  })

  test("getPrompt fetches by id", async () => {
    const p = await PromptService.addPrompt({ name: "A", prompt: "b" })
    const fetched = await PromptService.getPrompt(p.id)
    expect(fetched?.id).toBe(p.id)
  })

  test("updatePrompt modifies record", async () => {
    const p = await PromptService.addPrompt({ name: "A", prompt: "b" })
    const updated = await PromptService.updatePrompt(p.id, { name: "C" })
    expect(updated.name).toBe("C")
  })

  test("deletePrompt removes record", async () => {
    const p = await PromptService.addPrompt({ name: "A", prompt: "b" })
    await PromptService.deletePrompt(p.id)
    expect(prompts.length).toBe(0)
  })
})
