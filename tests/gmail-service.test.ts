import { describe, beforeEach, test, expect, jest } from "@jest/globals"

let listThreadsFn: any
let sendEmailFn: any
let upsertMock = jest.fn()
let listMock = jest.fn()
let sendMock = jest.fn()
let modifyMock = jest.fn()
let updateMock = jest.fn(() => ({ eq: jest.fn(async () => ({})) }))
let selectMock = jest.fn(() => ({ in: jest.fn(async () => ({ data: [] })) }))
let tokenSelect: any
let tokenUpdate: any
let tokenRow: any

jest.mock("googleapis", () => {
  return {
    google: {
      auth: { OAuth2: jest.fn(() => ({ setCredentials: jest.fn() })) },
      gmail: jest.fn(() => ({
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

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === "gmail_tokens") {
        tokenSelect = jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: async () => ({ data: tokenRow, error: null }),
          })),
        }))
        tokenUpdate = jest.fn((data: any) => ({
          eq: jest.fn(async () => {
            tokenRow = { ...tokenRow, ...data }
            return { data: tokenRow, error: null }
          }),
        }))
        return {
          select: tokenSelect,
          update: tokenUpdate,
        }
      }
      return {
        upsert: upsertMock,
        update: updateMock,
        select: selectMock,
      }
    },
  }),
}))

describe("gmail-service", () => {
  beforeEach(() => {
    jest.resetModules()
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
    const mod = require("../services/gmail-api")
    listThreadsFn = mod.listThreads
    sendEmailFn = mod.sendEmail
  })

  test("listThreads requests inbox", async () => {
    listMock.mockResolvedValue({ data: { threads: [{ id: "t1" }] } })
    await listThreadsFn("u1", 5)
    expect(listMock).toHaveBeenCalledWith({
      userId: "me",
      maxResults: 5,
      q: "in:inbox",
      format: "full",
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
    ;(global as any).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: "new", expires_in: 3600 }),
    }))
    const tokens = require("../services/gmail-tokens")
    const tok = await tokens.getAccessToken("u1")
    expect(fetch).toHaveBeenCalled()
    expect(tokenUpdate).toHaveBeenCalled()
    expect(tok).toBe("new")
  })

  test("setThreadStarred modifies labels", async () => {
    const mod = require("../services/gmail-api")
    await mod.setThreadStarred("u1", "t1", true)
    expect(modifyMock).toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalled()
  })

  test("setThreadUnread modifies labels", async () => {
    const mod = require("../services/gmail-api")
    await mod.setThreadUnread("u1", "t1", false)
    expect(modifyMock).toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalled()
  })

  test("countUnreadEmailThreads returns count", async () => {
    selectMock.mockImplementation(() => ({
      eq: jest.fn(async () => ({ count: 2, error: null })),
    }))
    const mod = require("../services/gmail-supabase")
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
