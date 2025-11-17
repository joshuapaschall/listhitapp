import { describe, beforeEach, test, expect } from "@jest/globals"
import { listInboxThreads, listSentThreads, listAutosentMessages, countUnreadThreads } from "../services/message-service"

let threads: any[] = []
let messages: any[] = []

jest.mock("../lib/supabase", () => {
  const client = {

    from: (table: string) => {
      if (table === "message_threads") {
        return {
          select: () => {
            const query: any = {
              is: () => query,
              eq: () => query,
              order: () => query,
              limit: () => query,
              then: async (resolve: any) => resolve({ data: threads, count: threads.filter(t => t.unread).length, error: null })
            }
            return query
          }
        }
      }
      if (table === "messages") {
        return {
          select: () => {
            const query: any = {
              eq: () => query,
              is: () => query,
              order: () => query,
              then: async (resolve: any) => resolve({ data: messages, error: null })
            }
            return query
          }
        }
      }
      throw new Error(`Unexpected table ${table}`)
    }
  }
  return { supabase: client, supabaseAdmin: client }
})

describe("message-service", () => {
  beforeEach(() => { threads = []; messages = [] })

  test("listInboxThreads returns non-bulk threads", async () => {
    threads = [
      { id: "t1", buyers: { id: "b1" }, starred: false, unread: true, campaign_id: null, messages: [{ direction: "inbound", is_bulk: false, body: "hi", created_at: "2024" }] },
      { id: "t2", buyers: { id: "b2" }, starred: false, unread: false, campaign_id: null, messages: [{ direction: "outbound", is_bulk: true, body: "hi", created_at: "2024" }] }
    ]
    const res = await listInboxThreads()
    expect(res.map((t: any) => t.id)).toEqual(["t1"])
  })

  test("listSentThreads returns bulk threads", async () => {
    threads = [
      { id: "t1", buyers: { id: "b1" }, starred: false, unread: false, campaign_id: null, messages: [{ direction: "outbound", is_bulk: false, body: "msg", created_at: "2024" }] },
      { id: "t2", buyers: { id: "b2" }, starred: false, unread: false, campaign_id: null, messages: [{ direction: "outbound", is_bulk: true, body: "msg", created_at: "2024" }] }
    ]
    const res = await listSentThreads()
    expect(res.map((t: any) => t.id)).toEqual(["t1", "t2"])
  })

  test("filters unread threads", async () => {
    threads = [
      { id: "t1", buyers: { id: "b1" }, starred: false, unread: true, campaign_id: null, messages: [{ direction: "inbound", is_bulk: false, body: "hi", created_at: "2024" }] },
      { id: "t2", buyers: { id: "b2" }, starred: false, unread: false, campaign_id: null, messages: [{ direction: "inbound", is_bulk: false, body: "hi", created_at: "2024" }] }
    ]
    const res = await listInboxThreads({ unread: true })
    expect(res.map((t: any) => t.id)).toEqual(["t1"])
  })

  test("listSentThreads auto filter", async () => {
    threads = [
      { id: "t1", buyers: { id: "b1" }, starred: false, unread: false, messages: [{ direction: "outbound", is_bulk: false, body: "a", created_at: "2024" }] },
      { id: "t2", buyers: { id: "b2" }, starred: false, unread: false, messages: [{ direction: "outbound", is_bulk: true, body: "b", created_at: "2024" }] }
    ]
    const auto = await listSentThreads({ auto: true })
    expect(auto.map((t: any) => t.id)).toEqual(["t2"])
    const manual = await listSentThreads({ auto: false })
    expect(manual.map((t: any) => t.id)).toEqual(["t1"])
  })

  test("listSentThreads keeps thread when latest is inbound", async () => {
    threads = [
      {
        id: "t1",
        buyers: { id: "b1" },
        starred: false,
        unread: false,
        messages: [
          { direction: "outbound", is_bulk: false, body: "hi", created_at: "2024-01-01" },
          { direction: "inbound", is_bulk: false, body: "hey", created_at: "2024-01-02" },
        ],
      },
    ]
    const res = await listSentThreads()
    expect(res.map((t: any) => t.id)).toEqual(["t1"])
  })

  test("countUnreadThreads", async () => {
    threads = [
      { id: "t1", buyers: { id: "b1" }, unread: true, messages: [] },
      { id: "t2", buyers: { id: "b2" }, unread: false, messages: [] }
    ]
    const count = await countUnreadThreads()
    expect(count).toBe(1)
  })

  test("listAutosentMessages returns outbound bulk messages", async () => {
    messages = [
      { id: "m1", body: "hi", created_at: "2024", direction: "outbound", is_bulk: true, buyers: { id: "b1", full_name: "John" }, message_threads: { id: "t1", phone_number: "123" } },
      { id: "m2", body: "bye", created_at: "2024", direction: "outbound", is_bulk: true, buyers: { id: "b2", full_name: "Jane" }, message_threads: { id: "t2", phone_number: "456" } }
    ]
    const res = await listAutosentMessages()
    expect(res.map((m: any) => m.id)).toEqual(["m1", "m2"])
  })
})
