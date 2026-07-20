import {
  listInboxThreads,
  listSentThreads,
  listAutosentMessages,
  countUnreadThreads,
  INBOX_PAGE_SIZE,
} from "../services/message-service"

let threads: any[] = []
let messages: any[] = []

// Membership + ordering now live in the DB (rollup columns + keyset pagination),
// so the mock just returns whatever the query "matched" — it must support every
// chainable method the service uses: is/eq/order/limit plus not/or/range.
vi.mock("../lib/supabase", () => {
  const client = {
    from: (table: string) => {
      if (table === "message_threads") {
        return {
          select: () => {
            const query: any = {
              is: () => query,
              eq: () => query,
              not: () => query,
              or: () => query,
              range: () => query,
              order: () => query,
              limit: () => query,
              then: async (resolve: any) =>
                resolve({ data: threads, count: threads.filter((t) => t.unread).length, error: null }),
            }
            return query
          },
        }
      }
      if (table === "messages") {
        return {
          select: () => {
            const query: any = {
              eq: () => query,
              is: () => query,
              not: () => query,
              or: () => query,
              range: () => query,
              order: () => query,
              limit: () => query,
              then: async (resolve: any) => resolve({ data: messages, error: null }),
            }
            return query
          },
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
  }
  return { supabase: client, supabaseAdmin: client }
})

const inboundThread = (id: string, over: Record<string, any> = {}) => ({
  id,
  buyers: { id: `b-${id}` },
  starred: false,
  unread: false,
  campaign_id: null,
  last_message_at: "2024-01-02T00:00:00Z",
  last_message_body: `body-${id}`,
  last_message_direction: "inbound",
  last_message_is_bulk: false,
  has_inbound: true,
  ...over,
})

describe("message-service", () => {
  beforeEach(() => {
    threads = []
    messages = []
  })

  test("listInboxThreads returns a { rows, nextCursor } page and maps last_message", async () => {
    threads = [inboundThread("t1", { last_message_body: "hi" })]
    const res = await listInboxThreads()
    expect(res.rows.map((t: any) => t.id)).toEqual(["t1"])
    expect(res.rows[0].last_message).toBe("hi")
    // Fewer than a full page -> no next cursor.
    expect(res.nextCursor).toBeNull()
  })

  test("listInboxThreads({ unread: true }) returns rows and no cursor for a short page", async () => {
    threads = [inboundThread("t1", { unread: true })]
    const res = await listInboxThreads({ unread: true })
    expect(res.rows.map((t: any) => t.id)).toEqual(["t1"])
    expect(res.nextCursor).toBeNull()
  })

  test("a full page yields a keyset nextCursor from the last row", async () => {
    threads = Array.from({ length: INBOX_PAGE_SIZE }, (_, i) =>
      inboundThread(`t${i}`, { last_message_at: `2024-01-01T00:00:${String(i).padStart(2, "0")}Z` }),
    )
    const res = await listInboxThreads()
    expect(res.rows).toHaveLength(INBOX_PAGE_SIZE)
    const last = threads[threads.length - 1]
    expect(res.nextCursor).toEqual({ at: last.last_message_at, id: last.id })
  })

  test("listSentThreads returns a mapped page", async () => {
    threads = [
      inboundThread("t1", {
        last_message_direction: "outbound",
        last_message_is_bulk: false,
        last_message_body: "manual reply",
      }),
    ]
    const res = await listSentThreads()
    expect(res.rows.map((t: any) => t.id)).toEqual(["t1"])
    expect(res.rows[0].last_message).toBe("manual reply")
    expect(res.nextCursor).toBeNull()
  })

  test("countUnreadThreads", async () => {
    threads = [
      { id: "t1", buyers: { id: "b1" }, unread: true },
      { id: "t2", buyers: { id: "b2" }, unread: false },
    ]
    const count = await countUnreadThreads()
    expect(count).toBe(1)
  })

  test("listAutosentMessages returns a { rows, nextCursor } page of bulk outbound", async () => {
    messages = [
      { id: "m1", body: "hi", created_at: "2024", buyers: { id: "b1", full_name: "John" }, message_threads: { id: "t1", phone_number: "123" } },
      { id: "m2", body: "bye", created_at: "2024", buyers: { id: "b2", full_name: "Jane" }, message_threads: { id: "t2", phone_number: "456" } },
    ]
    const res = await listAutosentMessages()
    expect(res.rows.map((m: any) => m.id)).toEqual(["m1", "m2"])
    expect(res.nextCursor).toBeNull()
  })
})
