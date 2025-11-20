import { describe, expect, test, beforeEach } from "@jest/globals"
import { TemplateService } from "../services/template-service"

type TableName = "sms_templates" | "email_templates" | "quick_reply_templates"

let tables: Record<TableName, any[]> = {
  sms_templates: [],
  email_templates: [],
  quick_reply_templates: [],
}
let idCounter = 1

jest.mock("../lib/supabase", () => {
  const from = (table: string) => {
    if (!(table in tables)) throw new Error(`Unexpected table ${table}`)
    const store = tables[table as TableName]
    return {
      insert: (rows: any[]) => {
        const record = { id: `t${idCounter++}`, ...rows[0] }
        store.push(record)
        return {
          select: () => ({ single: async () => ({ data: record, error: null }) })
        }
      },
      select: () => {
        let result = [...store]
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
              const idx = store.findIndex((t) => t[col] === val)
              if (idx !== -1) {
                store[idx] = { ...store[idx], ...updates }
                return { data: store[idx], error: null }
              }
              return { data: null, error: null }
            }
          })
        })
      }),
      delete: () => ({
        eq: async (col: string, val: any) => {
          const idx = store.findIndex((t) => t[col] === val)
          if (idx !== -1) store.splice(idx, 1)
          return { error: null }
        }
      })
    }
  }
  const client = { from }
  return { supabase: client, supabaseAdmin: client }
})

describe("TemplateService", () => {
  beforeEach(() => {
    tables = {
      sms_templates: [],
      email_templates: [],
      quick_reply_templates: [],
    }
    idCounter = 1
  })

  test("addTemplate inserts record", async () => {
    const tpl = await TemplateService.addTemplate({ name: "Hello", message: "Hi" })
    expect(tpl.id).toBeDefined()
    expect(tables.sms_templates.length).toBe(1)
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
    expect(tables.sms_templates.length).toBe(0)
  })

  test("uses correct table for non-SMS templates", async () => {
    await TemplateService.addTemplate({ name: "Email", message: "Hello" }, "email")
    await TemplateService.addTemplate({ name: "Quick", message: "Hi" }, "quick_reply")
    expect(tables.email_templates.length).toBe(1)
    expect(tables.quick_reply_templates.length).toBe(1)
  })
})
