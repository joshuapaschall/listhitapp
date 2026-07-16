import { NextRequest } from "next/server"
import { vi } from "vitest"

process.env.SITE_URL = "https://app.example.com"
process.env.EMAIL_UNSUBSCRIBE_SECRET = "test-secret"

const H = vi.hoisted(() => {
  class SenderNotVerifiedError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "SenderNotVerifiedError"
    }
  }
  const state = { orgId: "org-1" as string | null, campaignRow: null as any }
  const eqCalls: Array<[string, any]> = []
  const mutations: string[] = []
  const sendSesEmailMock = vi.fn()
  const resolveCampaignSenderMock = vi.fn()
  const stampMock = vi.fn(async (html: string) => html)

  function builder(table: string) {
    const b: any = {
      select: () => b,
      eq: (col: string, val: any) => {
        eqCalls.push([col, val])
        return b
      },
      insert: () => {
        mutations.push(`insert:${table}`)
        return b
      },
      upsert: () => {
        mutations.push(`upsert:${table}`)
        return b
      },
      update: () => {
        mutations.push(`update:${table}`)
        return b
      },
      maybeSingle: async () => {
        if (table === "campaigns") return { data: state.campaignRow, error: null }
        if (table === "profiles") {
          return { data: { full_name: "Test User", display_name: null, phone: "" }, error: null }
        }
        return { data: null, error: null }
      },
    }
    return b
  }

  return {
    SenderNotVerifiedError,
    state,
    eqCalls,
    mutations,
    sendSesEmailMock,
    resolveCampaignSenderMock,
    stampMock,
    builder,
  }
})

vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: vi.fn(async () => ({ user: { id: "user-1" }, orgId: H.state.orgId, supabase: {} })),
}))
vi.mock("@/lib/permissions/server", () => ({
  requirePermission: vi.fn(async () => null),
}))
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: (t: string) => H.builder(t) },
}))
vi.mock("@/lib/ses", () => ({ sendSesEmail: H.sendSesEmailMock }))
vi.mock("@/lib/email-sender-resolver", () => ({
  resolveCampaignSender: H.resolveCampaignSenderMock,
  SenderNotVerifiedError: H.SenderNotVerifiedError,
}))
vi.mock("@/services/campaign-sender", () => ({
  stampBusinessAddressForCampaign: H.stampMock,
}))

import { POST } from "../app/api/campaigns/test-send/route"

const validCampaign = {
  id: "camp-1",
  org_id: "org-1",
  channel: "email",
  message: "<p>Hi {{first_name}}</p>",
  subject: "Deal for {{first_name}}",
  from_email: "sender@verified.com",
  from_name: "Sender",
  user_id: "owner-1",
}

function post(body: any) {
  return POST(
    new NextRequest("http://test/api/campaigns/test-send", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  )
}

beforeEach(() => {
  H.state.orgId = "org-1"
  H.state.campaignRow = { ...validCampaign }
  H.eqCalls.length = 0
  H.mutations.length = 0
  H.sendSesEmailMock.mockReset()
  H.sendSesEmailMock.mockResolvedValue({ MessageId: "m-1" })
  H.resolveCampaignSenderMock.mockReset()
  H.resolveCampaignSenderMock.mockResolvedValue({
    fromEmail: "sender@verified.com",
    fromName: "Sender",
    replyTo: undefined,
  })
  H.stampMock.mockClear()
  process.env.EMAIL_PHYSICAL_ADDRESS = "Acme LLC, 1 Main St, Town, GA"
})

describe("POST /api/campaigns/test-send", () => {
  test("a campaign in another org is not found (org_id scope enforced)", async () => {
    H.state.campaignRow = null // org filter yields nothing
    const res = await post({ campaignId: "camp-other", to: "me@example.com" })
    expect(res.status).toBe(404)
    expect(H.eqCalls).toContainEqual(["org_id", "org-1"])
    expect(H.sendSesEmailMock).not.toHaveBeenCalled()
  })

  test("SenderNotVerifiedError → 422 with the resolver's message", async () => {
    H.resolveCampaignSenderMock.mockRejectedValueOnce(
      new H.SenderNotVerifiedError("The sender domain isn't verified."),
    )
    const res = await post({ campaignId: "camp-1", to: "me@example.com" })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("The sender domain isn't verified.")
    expect(H.sendSesEmailMock).not.toHaveBeenCalled()
  })

  test("missing EMAIL_PHYSICAL_ADDRESS → 500 and no send", async () => {
    delete process.env.EMAIL_PHYSICAL_ADDRESS
    const res = await post({ campaignId: "camp-1", to: "me@example.com" })
    expect(res.status).toBe(500)
    expect(H.sendSesEmailMock).not.toHaveBeenCalled()
  })

  test("invalid to → 400 and no send", async () => {
    const res = await post({ campaignId: "camp-1", to: "not-an-email" })
    expect(res.status).toBe(400)
    expect(H.sendSesEmailMock).not.toHaveBeenCalled()
  })

  test("happy path: one send, [TEST] subject, text/plain, resolver from, no tags", async () => {
    const res = await post({ campaignId: "camp-1", to: "me@example.com" })
    expect(res.status).toBe(200)
    expect(H.sendSesEmailMock).toHaveBeenCalledTimes(1)

    const arg = H.sendSesEmailMock.mock.calls[0][0]
    expect(arg.subject.startsWith("[TEST] ")).toBe(true)
    expect(typeof arg.text).toBe("string")
    expect(arg.text.length).toBeGreaterThan(0)
    expect(arg.fromEmail).toBe("sender@verified.com")
    expect("tags" in arg).toBe(false)
  })

  test("happy path writes no campaign state", async () => {
    await post({ campaignId: "camp-1", to: "me@example.com" })
    expect(H.mutations).toEqual([])
  })
})
