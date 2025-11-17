import { describe, expect, test, beforeEach } from "@jest/globals"
import { TemplateService } from "../services/template-service"

let templates: any[] = []
let idCounter = 1

jest.mock("../lib/supabase", () => {
  const client = {
      from: (table: string) => {
        if (table !== "message_templates") throw new Error(`Unexpected table ${table}`)

        return {
          insert: (rows: any[]) => {
            const record = { id: `t${idCounter++}`, ...rows[0] }
            templates.push(record)
            return {
              select: () => ({ single: async () => ({ data: record, error: null }) })
            }
          },
          select: () => {
            let result = [...templates]
            const query: any = {
              order: (_col: string, opts: any) => {
                if (opts.ascending === false) result.reverse()
                return query
              },
              eq: (col: string, val: any) => {
                result = result.filter((t) => t[col] === val)
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
                  const idx = templates.findIndex((t) => t[col] === val)
                  if (idx !== -1) {
                    templates[idx] = { ...templates[idx], ...updates }
                    return { data: templates[idx], error: null }
                  }
                  return { data: null, error: null }
                }
              })
            })
          }),
          delete: () => ({
            eq: async (col: string, val: any) => {
              const idx = templates.findIndex((t) => t[col] === val)
              if (idx !== -1) templates.splice(idx, 1)
              return { error: null }
            }
          })
        }
      }
    }
  return { supabase: client, supabaseAdmin: client }
})

describe("TemplateService", () => {
  beforeEach(() => {
    templates = []
    idCounter = 1
  })

  test("addTemplate inserts record", async () => {
    const tpl = await TemplateService.addTemplate({ name: "Hello", message: "Hi" })
    expect(tpl.id).toBeDefined()
    expect(templates.length).toBe(1)
  })

  test("listTemplates returns inserted records", async () => {
    await TemplateService.addTemplate({ name: "A", message: "a" })
    await TemplateService.addTemplate({ name: "B", message: "b" })
    const list = await TemplateService.listTemplates()
    expect(list.length).toBe(2)
  })

  test("getTemplate fetches by id", async () => {
    const tpl = await TemplateService.addTemplate({ name: "A", message: "b" })
    const fetched = await TemplateService.getTemplate(tpl.id)
    expect(fetched?.id).toBe(tpl.id)
  })

  test("updateTemplate modifies record", async () => {
    const tpl = await TemplateService.addTemplate({ name: "A", message: "b" })
    const updated = await TemplateService.updateTemplate(tpl.id, { name: "C" })
    expect(updated.name).toBe("C")
  })

  test("deleteTemplate removes record", async () => {
    const tpl = await TemplateService.addTemplate({ name: "A", message: "b" })
    await TemplateService.deleteTemplate(tpl.id)
    expect(templates.length).toBe(0)
  })
})
