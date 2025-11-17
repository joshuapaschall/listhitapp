import { describe, beforeEach, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"

jest.mock("next/headers", () => ({
  cookies: () => ({ get: jest.fn(), set: jest.fn(), delete: jest.fn() }),
}))

jest.mock("@supabase/auth-helpers-nextjs", () => ({
  __esModule: true,
  createRouteHandlerClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
  }),
}))

let listThreads: any
let getThread: any
let syncThreads: any
let buildMessage: any
let buildReply: any
let sendEmail: any
let deleteThreadFn: any
let setStarred: any
let setUnread: any
let supabase: any

jest.mock("../services/gmail-api", () => {
  return {
    listThreads: jest.fn(async () => [{ id: "t1" }]),
    getThread: jest.fn(async (_userId: string, id: string) => ({
      id,
      messages: [{ payload: { headers: [{ name: "Message-ID", value: "<m1>" }] } }],
    })),
    buildMessage: jest.fn(() => "raw"),
    buildReply: jest.fn(() => "rawReply"),
    sendEmail: jest.fn(async () => ({ data: { id: "sent", threadId: "thr" } })),
    deleteThread: jest.fn(async () => ({})),
    archiveThread: jest.fn(async () => ({})),
    setThreadStarred: jest.fn(async () => ({})),
    setThreadUnread: jest.fn(async () => ({})),
  }
})

jest.mock("../scripts/gmail-sync", () => ({
  syncGmailThreads: jest.fn(async () => 0),
}))

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => supabase,
}))

function buildSupabase(rows: any[] = [], buyers: any[] = []) {
  const inserted: any[] = []
  const client = {
    inserted,
    from: (table: string) => {
      if (table === "gmail_threads") {
        return {
          select: () => ({
            order: () => ({ limit: async () => ({ data: rows, error: null }) }),
          }),
          eq: () => ({ maybeSingle: async () => ({ data: rows[0] || null, error: null }) }),
        }
      }
      if (table === "buyers") {
        return {
          select: () => ({
            eq: (_c: string, v: string) => ({
              maybeSingle: async () => ({
                data: buyers.find((b) => b.email_norm === v) || null,
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === "email_messages") {
        return {
          insert: async (rows: any) => {
            const arr = Array.isArray(rows) ? rows : [rows]
            inserted.push(...arr)
            return { data: arr, error: null }
          },
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
  }
  return client
}

describe("gmail routes", () => {
  beforeEach(() => {
    jest.resetModules()
    const mod = require("../services/gmail-api")
    listThreads = mod.listThreads
    getThread = mod.getThread
    buildMessage = mod.buildMessage
    buildReply = mod.buildReply
    sendEmail = mod.sendEmail
    deleteThreadFn = mod.deleteThread
    setStarred = mod.setThreadStarred
    setUnread = mod.setThreadUnread
    const sync = require("../scripts/gmail-sync")
    syncThreads = sync.syncGmailThreads
    process.env.GMAIL_FROM = "me@test.com"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "tok"
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://local"
    supabase = buildSupabase([], [])
  })

  test("threads route returns threads", async () => {
    supabase = buildSupabase([{ id: "c1", snippet: "s", history_id: "h" }])
    const { GET } = require("../app/api/gmail/threads/route")
    const req = new NextRequest("http://test")
    const res = await GET(req)
    const data = await res.json()
    expect(syncThreads).toHaveBeenCalled()
    expect(listThreads).not.toHaveBeenCalled()
    expect(getThread).toHaveBeenCalledWith("u1", "c1")
    expect(data.threads[0].id).toBe("c1")
  })

  test("threads route falls back to gmail", async () => {
    supabase = buildSupabase([])
    const { GET } = require("../app/api/gmail/threads/route")
    const req = new NextRequest("http://test")
    const res = await GET(req)
    const data = await res.json()
    expect(syncThreads).toHaveBeenCalled()
    expect(listThreads).toHaveBeenCalled()
    expect(getThread).toHaveBeenCalled()
    expect(data.threads[0].id).toBe("t1")
  })

  test("threads route propagates auth message", async () => {
    supabase = buildSupabase([])
    listThreads.mockRejectedValue(new Error("Failed to authenticate with Gmail. Check your credentials."))
    const { GET } = require("../app/api/gmail/threads/route")
    const req = new NextRequest("http://test")
    const res = await GET(req)
    const data = await res.json()
    expect(res.status).toBe(500)
    expect(data.error).toMatch(/authenticate with Gmail/i)
  })

  test("send route sends message", async () => {
    supabase = buildSupabase([], [{ id: "b1", email_norm: "a@test.com" }])
    const { POST } = require("../app/api/gmail/send/route")
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ to: "a@test.com", subject: "Hi", text: "hello" }),
    })
    const res = await POST(req)
    const data = await res.json()
    expect(buildMessage).toHaveBeenCalledWith({
      to: "a@test.com",
      from: "me@test.com",
      subject: "Hi",
      text: "hello",
      html: undefined,
    })
    expect(sendEmail).toHaveBeenCalledWith("u1", "raw")
    expect(getThread).toHaveBeenCalledWith("u1", "thr")
    expect(data.id).toBe("sent")
    expect(data.threadId).toBe("thr")
    expect(supabase.inserted.length).toBe(1)
    expect(supabase.inserted[0].buyer_id).toBe("b1")
  })

  test("reply route sends reply", async () => {
    supabase = buildSupabase([], [{ id: "b1", email_norm: "a@test.com" }])
    const { POST } = require("../app/api/gmail/reply/route")
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ threadId: "t1", to: "a@test.com", subject: "Re", text: "hi" }),
    })
    const res = await POST(req)
    const data = await res.json()
    expect(getThread).toHaveBeenCalledWith("u1", "t1")
    expect(buildReply).toHaveBeenCalledWith({
      to: "a@test.com",
      from: "me@test.com",
      subject: "Re",
      text: "hi",
      html: undefined,
      inReplyTo: "<m1>",
      references: [],
    })
    expect(sendEmail).toHaveBeenCalledWith("u1", "rawReply", "t1")
    expect(data.id).toBe("sent")
    expect(supabase.inserted.length).toBe(1)
    expect(supabase.inserted[0].buyer_id).toBe("b1")
  })

  test("delete route deletes thread", async () => {
    const { POST } = require("../app/api/gmail/delete/route")
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ threadId: "t1" }),
    })
    const res = await POST(req)
    const data = await res.json()
    expect(deleteThreadFn).toHaveBeenCalledWith("u1", "t1")
    expect(data.success).toBe(true)
  })

  test("star route updates star", async () => {
    const { POST } = require("../app/api/gmail/star/route")
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ threadId: "t1", starred: true }),
    })
    const res = await POST(req)
    const data = await res.json()
    expect(setStarred).toHaveBeenCalledWith("u1", "t1", true)
    expect(data.success).toBe(true)
  })

  test("unread route updates flag", async () => {
    const { POST } = require("../app/api/gmail/unread/route")
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ threadId: "t1", unread: false }),
    })
    const res = await POST(req)
    const data = await res.json()
    expect(setUnread).toHaveBeenCalledWith("u1", "t1", false)
    expect(data.success).toBe(true)
  })

  test("sync route GET returns 405", async () => {
    const { GET } = require("../app/api/gmail/sync/route")
    const req = new NextRequest("http://test")
    const res = await GET(req)
    const body = await res.json()
    expect(res.status).toBe(405)
    expect(body.message).toMatch(/POST/i)
  })
})
