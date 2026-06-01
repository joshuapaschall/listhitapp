import { NextRequest } from "next/server"

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))
vi.mock("mimetext", () => ({
  createMimeMessage: () => ({
    setSender: vi.fn(),
    setRecipients: vi.fn(),
    setCc: vi.fn(),
    setBcc: vi.fn(),
    setSubject: vi.fn(),
    setHeader: vi.fn(),
    addMessage: vi.fn(),
    addAttachment: vi.fn(),
    asRaw: vi.fn(() => "raw"),
  }),
}), { virtual: true })

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  __esModule: true,
  createRouteHandlerClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: "admin" }, error: null }) }) }) }
      }
      if (table === "permissions") {
        const query = { eq: () => query, then: (resolve: any) => resolve({ data: [], error: null }) }
        return { select: () => query }
      }
      return supabase.from(table)
    },
  }),
}))

let listThreads: any
let getThread: any
let listDrafts: any
let getDraftFn: any
let sendDraftFn: any
let buildMessage: any
let buildReply: any
let sendEmail: any
let deleteThreadFn: any
let setStarred: any
let setUnread: any
let supabase: any

function gmailApiMockFactory() {
  return {
    listThreads: vi.fn(async () => ({ threads: [{ id: "t1" }], nextPageToken: null, resultSizeEstimate: 1 })),
    getThread: vi.fn(async (_userId: string, id: string) => ({
      id,
      messages: [{ payload: { headers: [{ name: "Message-ID", value: "<m1>" }] } }],
    })),
    listDrafts: vi.fn(async () => [{ id: "d1", messageId: "m1", threadId: "t1" }]),
    getDraft: vi.fn(async () => ({
      id: "d1",
      message: {
        id: "m1",
        threadId: "t1",
        payload: { headers: [{ name: "To", value: "x@test.com" }, { name: "Subject", value: "Subj" }] },
      },
    })),
    sendDraft: vi.fn(async () => ({ id: "sent", threadId: "t1" })),
    buildMessage: vi.fn(() => "raw"),
    buildReply: vi.fn(() => "rawReply"),
    sendEmail: vi.fn(async () => ({ data: { id: "sent", threadId: "thr" } })),
    deleteThread: vi.fn(async () => ({})),
    archiveThread: vi.fn(async () => ({})),
    setThreadStarred: vi.fn(async () => ({})),
    setThreadUnread: vi.fn(async () => ({})),
  }
}
vi.mock("../services/gmail-api", gmailApiMockFactory)
vi.mock("@/services/gmail-api", gmailApiMockFactory)

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => supabase,
}))

vi.mock("@/lib/supabase", () => ({
  get supabaseAdmin() {
    return supabase
  },
  get supabase() {
    return supabase
  },
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
  beforeEach(async () => {
    vi.resetModules()
    const mod = await import("../services/gmail-api")
    listThreads = mod.listThreads
    getThread = mod.getThread
    buildMessage = mod.buildMessage
    buildReply = mod.buildReply
    sendEmail = mod.sendEmail
    deleteThreadFn = mod.deleteThread
    setStarred = mod.setThreadStarred
    setUnread = mod.setThreadUnread
    listDrafts = mod.listDrafts
    getDraftFn = mod.getDraft
    sendDraftFn = mod.sendDraft
    process.env.GMAIL_FROM = "me@test.com"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "tok"
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://local"
    supabase = buildSupabase([], [])
  })

  test("threads route returns threads", async () => {
    supabase = buildSupabase([{ id: "c1", snippet: "s", history_id: "h" }])
    const { GET } = await import("../app/api/gmail/threads/route")
    const req = new NextRequest("http://test?folder=inbox")
    const res = await GET(req)
    const data = await res.json()
    expect(listThreads).toHaveBeenCalled()
    expect(getThread).toHaveBeenCalledWith("u1", "t1")
    expect(data.threads[0].id).toBe("t1")
  })

  test("threads route falls back to gmail", async () => {
    supabase = buildSupabase([])
    const { GET } = await import("../app/api/gmail/threads/route")
    const req = new NextRequest("http://test")
    const res = await GET(req)
    const data = await res.json()
    expect(listThreads).toHaveBeenCalled()
    expect(getThread).toHaveBeenCalled()
    expect(data.threads[0].id).toBe("t1")
  })

  test("threads route propagates auth message", async () => {
    supabase = buildSupabase([])
    listThreads.mockRejectedValue(new Error("Failed to authenticate with Gmail. Check your credentials."))
    const { GET } = await import("../app/api/gmail/threads/route")
    const req = new NextRequest("http://test")
    const res = await GET(req)
    const data = await res.json()
    expect(res.status).toBe(500)
    expect(data.error).toMatch(/authenticate with Gmail/i)
  })

  test("send route sends message", async () => {
    supabase = buildSupabase([], [{ id: "b1", email_norm: "a@test.com" }])
    const { POST } = await import("../app/api/gmail/send/route")
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
    const { POST } = await import("../app/api/gmail/reply/route")
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
    const { POST } = await import("../app/api/gmail/delete/route")
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
    const { POST } = await import("../app/api/gmail/star/route")
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
    const { POST } = await import("../app/api/gmail/unread/route")
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
    const { GET } = await import("../app/api/gmail/sync/route")
    const req = new NextRequest("http://test")
    const res = await GET(req)
    const body = await res.json()
    expect(res.status).toBe(405)
    expect(body.message).toMatch(/POST/i)
  })

  test("draft list route returns drafts", async () => {
    const { GET } = await import("../app/api/gmail/drafts/route")
    const req = new NextRequest("http://test")
    const res = await GET(req)
    const data = await res.json()
    expect(listDrafts).toHaveBeenCalledWith("u1")
    expect(data.drafts[0].id).toBe("d1")
  })

  test("draft get route returns draft payload", async () => {
    const { GET } = await import("../app/api/gmail/drafts/[id]/route")
    const req = new NextRequest("http://test")
    const res = await GET(req, { params: { id: "d1" } })
    const data = await res.json()
    expect(getDraftFn).toHaveBeenCalledWith("u1", "d1")
    expect(data.draft.id).toBe("d1")
  })

  test("draft send route sends draft", async () => {
    const { POST } = await import("../app/api/gmail/drafts/[id]/send/route")
    const req = new NextRequest("http://test", { method: "POST" })
    const res = await POST(req, { params: { id: "d1" } })
    const data = await res.json()
    expect(sendDraftFn).toHaveBeenCalledWith("u1", "d1")
    expect(data.threadId).toBe("t1")
  })
})
