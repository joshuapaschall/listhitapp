let listThreadsFn: any
let sendEmailFn: any
let upsertMock = vi.fn()
let listMock = vi.fn()
let sendMock = vi.fn()
let modifyMock = vi.fn()
let updateMock = vi.fn(() => ({ eq: vi.fn(async () => ({})) }))
let selectMock = vi.fn(() => ({ in: vi.fn(async () => ({ data: [] })) }))
let tokenSelect: any
let tokenUpdate: any
let tokenRow: any

vi.mock("googleapis", () => {
  return {
    google: {
      auth: { OAuth2: vi.fn(() => ({ setCredentials: vi.fn() })) },
      gmail: vi.fn(() => ({
        users: {
          threads: {
            list: (...args: any[]) => listMock(...args),
            modify: (...args: any[]) => modifyMock(...args),
          },
          messages: { send: (...args: any[]) => sendMock(...args) },
        },
      })),
    },
  }
})

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "gmail_tokens") {
        const chain: any = {
          eq: () => chain,
          maybeSingle: async () => ({ data: tokenRow, error: null }),
        }
        tokenSelect = vi.fn(() => chain)
        tokenUpdate = vi.fn((data: any) => ({
          eq: vi.fn(async () => {
            tokenRow = { ...tokenRow, ...data }
            return { data: tokenRow, error: null }
          }),
        }))
        return { select: tokenSelect, update: tokenUpdate }
      }
      return { upsert: upsertMock, update: updateMock, select: selectMock }
    },
  },
  supabase: {
    from: () => ({ select: selectMock }),
  },
}))

describe("gmail-service", () => {
  beforeEach(async () => {
    vi.resetModules()
    listMock.mockReset()
    sendMock.mockReset()
    upsertMock.mockReset()
    selectMock.mockReset()
    tokenRow = {
      user_id: "u1",
      refresh_token: "ref",
      access_token: "old",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    }
    process.env.GOOGLE_CLIENT_ID = "id"
    process.env.GOOGLE_CLIENT_SECRET = "sec"
    process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI = "uri"
    process.env.GMAIL_FROM = "me@test.com"
    const mod = await import("../services/gmail-api")
    listThreadsFn = mod.listThreads
    sendEmailFn = mod.sendEmail
  })

  test("listThreads requests inbox", async () => {
    listMock.mockResolvedValue({ data: { threads: [{ id: "t1" }] } })
    await listThreadsFn("u1", 5)
    expect(listMock).toHaveBeenCalledWith({
      userId: "me",
      maxResults: 5,
      format: "full",
      labelIds: ["INBOX"],
    })
    expect(upsertMock).toHaveBeenCalled()
    expect(tokenSelect).toHaveBeenCalled()
  })

  test("sendEmail posts message", async () => {
    sendMock.mockResolvedValue({})
    await sendEmailFn("u1", "raw", "t1")
    expect(sendMock).toHaveBeenCalledWith({
      userId: "me",
      requestBody: { raw: "raw", threadId: "t1" },
    })
  })

  test("getAccessToken refreshes expired token", async () => {
    tokenRow.expires_at = 0
    ;(global as any).fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: "new", expires_in: 3600 }),
    }))
    const tokens = await import("../services/gmail-tokens")
    const tok = await tokens.getAccessToken("u1")
    expect(fetch).toHaveBeenCalled()
    expect(tokenUpdate).toHaveBeenCalled()
    expect(tok).toBe("new")
  })

  test("setThreadStarred modifies labels", async () => {
    const mod = await import("../services/gmail-api")
    await mod.setThreadStarred("u1", "t1", true)
    expect(modifyMock).toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalled()
  })

  test("setThreadUnread modifies labels", async () => {
    const mod = await import("../services/gmail-api")
    await mod.setThreadUnread("u1", "t1", false)
    expect(modifyMock).toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalled()
  })

  test("countUnreadEmailThreads returns count", async () => {
    selectMock.mockImplementation(() => ({
      eq: vi.fn(async () => ({ count: 2, error: null })),
    }))
    const mod = await import("../services/gmail-supabase")
    const count = await mod.countUnreadEmailThreads()
    expect(selectMock).toHaveBeenCalled()
    expect(count).toBe(2)
  })

  test("listThreads surfaces auth message", async () => {
    listMock.mockRejectedValue({
      response: { status: 401 },
      message: "invalid_grant",
    })
    await expect(listThreadsFn("u1", 5)).rejects.toThrow(/authenticate with Gmail/i)
  })
})
