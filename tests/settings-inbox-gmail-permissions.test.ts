import { NextRequest } from "next/server"

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

const state = vi.hoisted(() => ({
  currentUser: { id: "user-1" } as { id: string } | null,
  callerRole: "user",
  permissions: [] as any[],
}))

function createPermissionClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: state.currentUser }, error: null }),
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { role: state.callerRole }, error: null }),
            }),
          }),
        }
      }

      if (table === "permissions") {
        const query = {
          eq: () => query,
          then: (resolve: any) => resolve({ data: state.permissions, error: null }),
        }
        return {
          select: () => query,
        }
      }

      throw new Error(`Unexpected permission table ${table}`)
    },
  }
}

function createAdminQuery(table: string) {
  const query: any = {
    select: () => query,
    eq: () => query,
    in: () => query,
    order: () => Promise.resolve({ data: [], error: null }),
    maybeSingle: async () => ({ data: table === "inbound_numbers" ? { org_id: "org-1" } : null, error: null }),
    single: async () => ({ data: null, error: null }),
    insert: () => query,
    update: () => query,
    delete: () => query,
    limit: () => query,
    ilike: () => query,
    is: () => query,
    then: (resolve: any) => resolve({ data: [], error: null, count: 0 }),
  }
  return query
}

const adminClient = {
  from: (table: string) => createAdminQuery(table),
  storage: {
    from: () => ({
      upload: async () => ({ error: null }),
      getPublicUrl: () => ({ data: { publicUrl: "https://example.com/file.mp3" } }),
    }),
  },
}

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: () => createPermissionClient(),
  createServerComponentClient: () => createPermissionClient(),
}))

vi.mock("@/lib/supabase", () => ({
  supabase: adminClient,
  supabaseAdmin: adminClient,
}))

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: adminClient,
}))

vi.mock("@/lib/ses-identities", () => ({
  buildDnsRecords: () => [],
  createDomainIdentity: async () => ({
    dkimTokens: [],
    dkimStatus: "pending",
    verifiedForSending: false,
    mailFromDomain: null,
    mailFromStatus: null,
  }),
  deleteDomainIdentity: async () => undefined,
  deriveDomainStatus: () => "pending",
  getDomainIdentityStatus: async () => ({
    dkimTokens: [],
    dkimStatus: "pending",
    verifiedForSending: false,
    mailFromDomain: null,
    mailFromStatus: null,
  }),
}))

vi.mock("@/services/gmail-api", () => ({
  buildMessage: vi.fn(),
  buildMessageWithAttachments: vi.fn(),
  sendEmail: vi.fn(),
  getThread: vi.fn(),
}))

vi.mock("@/utils/assert-server", () => ({
  assertServer: () => undefined,
}))

async function expectForbidden(response: Response, permission: string) {
  expect(response.status).toBe(403)
  await expect(response.json()).resolves.toMatchObject({ missingPermission: permission })
}

describe("settings, inbox, and Gmail permission gates", () => {
  beforeEach(() => {
    vi.resetModules()
    state.currentUser = { id: "user-1" }
    state.callerRole = "user"
    state.permissions = []
  })

  test("messages/send is denied without inbox.send and allowed with the key", async () => {
    const { POST } = await import("../app/api/messages/send/route")
    const deniedReq = new NextRequest("http://test/api/messages/send", { method: "POST" })
    await expectForbidden(await POST(deniedReq), "inbox.send")

    state.permissions = [{ permission_key: "inbox.send", granted: true }]
    const allowedReq = new NextRequest("http://test/api/messages/send", {
      method: "POST",
      body: JSON.stringify({}),
    })
    expect((await POST(allowedReq)).status).toBe(400)
  })

  test("markets route is denied without settings.markets and allowed for admins", async () => {
    const { GET } = await import("../app/api/markets/route")
    await expectForbidden(await GET(), "settings.markets")

    state.callerRole = "admin"
    expect((await GET()).status).toBe(200)
  })

  test("gmail/send is denied without gmail.access and allowed with the key", async () => {
    const { POST } = await import("../app/api/gmail/send/route")
    const deniedReq = new NextRequest("http://test/api/gmail/send", {
      method: "POST",
      body: new FormData(),
    })
    await expectForbidden(await POST(deniedReq), "gmail.access")

    state.permissions = [{ permission_key: "gmail.access", granted: true }]
    const allowedReq = new NextRequest("http://test/api/gmail/send", {
      method: "POST",
      body: new FormData(),
    })
    expect((await POST(allowedReq)).status).toBe(400)
  })

  test("email domains route is denied without settings.email_domains and allowed with the key", async () => {
    const { GET } = await import("../app/api/email/domains/route")
    await expectForbidden(await GET(), "settings.email_domains")

    state.permissions = [{ permission_key: "settings.email_domains", granted: true }]
    expect((await GET()).status).toBe(200)
  })
})
