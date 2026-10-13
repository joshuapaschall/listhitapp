// ensureOrgSubaccount / ensureOrgVoiceCredentials: idempotent, owner org refused,
// secrets stored encrypted. twilio, the parent client and Supabase are mocked;
// secret-box is real (with a test key).
import crypto from "crypto"

const h = vi.hoisted(() => {
  const tables: Record<string, Array<Record<string, any>>> = { org_twilio_credentials: [], org_twilio: [] }
  const parent = {
    list: vi.fn(),
    create: vi.fn(),
  }
  const sub = {
    newApiKeyCreate: vi.fn(),
    applicationsCreate: vi.fn(),
    clientArgs: [] as any[],
  }

  const admin = {
    from: (table: string) => {
      const rows = () => (tables[table] ||= [])
      const filters: Array<[string, any]> = []
      const match = (r: any) => filters.every(([c, v]) => r[c] === v)
      const q: any = {
        select: () => q,
        eq: (c: string, v: any) => (filters.push([c, v]), q),
        maybeSingle: async () => ({ data: rows().find(match) ?? null, error: null }),
        insert: async (row: any) => {
          rows().push({ ...row })
          return { error: null }
        },
        upsert: async (row: any, opts: { onConflict: string }) => {
          const existing = rows().find((r) => r[opts.onConflict] === row[opts.onConflict])
          if (existing) Object.assign(existing, row)
          else rows().push({ ...row })
          return { error: null }
        },
        update: (patch: any) => {
          const u: any = {
            eq: (c: string, v: any) => {
              filters.push([c, v])
              return u
            },
            then: (resolve: any) => {
              rows().filter(match).forEach((r) => Object.assign(r, patch))
              return resolve({ error: null })
            },
          }
          return u
        },
      }
      return q
    },
  }
  return { tables, parent, sub, admin }
})

vi.mock("@/lib/supabase", () => ({ supabaseAdmin: h.admin }))
vi.mock("@/lib/twilio/parent", () => ({
  getParentAccountClient: () => ({
    api: { v2010: { accounts: Object.assign((sid: string) => ({ fetch: async () => ({ sid, authToken: "rotated" }) }), { list: h.parent.list, create: h.parent.create }) } },
  }),
  getParentAccountSid: () => "AC-parent",
  getParentAuthToken: () => "parent-token",
}))
vi.mock("twilio", () => {
  const factory = (...args: any[]) => {
    h.sub.clientArgs.push(args)
    return {
      iam: { v1: { newApiKey: { create: h.sub.newApiKeyCreate } } },
      applications: { create: h.sub.applicationsCreate },
    }
  }
  return { default: factory }
})

import { ensureOrgSubaccount, ensureOrgVoiceCredentials } from "@/lib/twilio/subaccounts"
import { clearCredentialsCache } from "@/lib/twilio/credentials"
import { encryptSecret, decryptSecret } from "@/lib/crypto/secret-box"

const ORG = "11111111-1111-4111-8111-111111111111"
const OWNER = "adddfd02-790e-4be7-a0df-047b7dbdd1b8"

describe("ensureOrgSubaccount", () => {
  beforeEach(() => {
    process.env.LISTHIT_SECRETS_KEY = crypto.randomBytes(32).toString("base64")
    process.env.TELNYX_PINNED_ORG_IDS = OWNER
    process.env.NEXT_PUBLIC_BASE_URL = "https://app.listhit.test/"
    h.tables.org_twilio_credentials = []
    h.tables.org_twilio = []
    h.parent.list.mockReset().mockResolvedValue([])
    h.parent.create.mockReset().mockResolvedValue({ sid: "AC-new", authToken: "plain-new-token", friendlyName: `listhit-org:${ORG}` })
    h.sub.newApiKeyCreate.mockReset().mockResolvedValue({ sid: "SK-new", secret: "plain-key-secret" })
    h.sub.applicationsCreate.mockReset().mockResolvedValue({ sid: "AP-new" })
    h.sub.clientArgs = []
    clearCredentialsCache()
  })

  test("the pinned owner org is refused", async () => {
    await expect(ensureOrgSubaccount(OWNER)).rejects.toThrow(
      "The owner org uses Telnyx and never gets a Twilio subaccount.",
    )
    expect(h.parent.list).not.toHaveBeenCalled()
    expect(h.parent.create).not.toHaveBeenCalled()
  })

  test("an existing credentials row is returned without listing or creating", async () => {
    h.tables.org_twilio_credentials = [
      { org_id: ORG, subaccount_sid: "AC-existing", auth_token_enc: encryptSecret("tok") },
    ]
    await expect(ensureOrgSubaccount(ORG)).resolves.toEqual({ subaccountSid: "AC-existing" })
    expect(h.parent.list).not.toHaveBeenCalled()
    expect(h.parent.create).not.toHaveBeenCalled()
  })

  test("an existing FriendlyName match is adopted, not created", async () => {
    h.parent.list.mockResolvedValue([
      { sid: "AC-orphan", authToken: "orphan-token", friendlyName: `listhit-org:${ORG}`, status: "active" },
    ])
    await expect(ensureOrgSubaccount(ORG)).resolves.toEqual({ subaccountSid: "AC-orphan" })
    expect(h.parent.list).toHaveBeenCalledWith(expect.objectContaining({ friendlyName: `listhit-org:${ORG}` }))
    expect(h.parent.create).not.toHaveBeenCalled()
    expect(h.tables.org_twilio_credentials[0].subaccount_sid).toBe("AC-orphan")
    expect(h.tables.org_twilio[0]).toEqual(expect.objectContaining({ org_id: ORG, subaccount_sid: "AC-orphan" }))
  })

  test("creates when nothing exists; the stored token is encrypted, not plaintext", async () => {
    await expect(ensureOrgSubaccount(ORG)).resolves.toEqual({ subaccountSid: "AC-new" })
    expect(h.parent.create).toHaveBeenCalledWith({ friendlyName: `listhit-org:${ORG}` })
    const row = h.tables.org_twilio_credentials[0]
    expect(row.auth_token_enc.startsWith("v1:")).toBe(true)
    expect(row.auth_token_enc).not.toContain("plain-new-token")
    expect(decryptSecret(row.auth_token_enc)).toBe("plain-new-token")
    expect(h.tables.org_twilio[0]).toEqual(expect.objectContaining({ org_id: ORG, subaccount_sid: "AC-new" }))
  })

  test("a second run is a no-op", async () => {
    await ensureOrgSubaccount(ORG)
    await ensureOrgSubaccount(ORG)
    expect(h.parent.create).toHaveBeenCalledTimes(1)
    expect(h.tables.org_twilio_credentials).toHaveLength(1)
  })
})

describe("ensureOrgVoiceCredentials", () => {
  beforeEach(async () => {
    process.env.LISTHIT_SECRETS_KEY = crypto.randomBytes(32).toString("base64")
    process.env.TELNYX_PINNED_ORG_IDS = OWNER
    process.env.NEXT_PUBLIC_BASE_URL = "https://app.listhit.test/"
    h.tables.org_twilio_credentials = [
      { org_id: ORG, subaccount_sid: "AC-sub", auth_token_enc: encryptSecret("sub-token"), api_key_sid: null, api_key_secret_enc: null, twiml_app_sid: null },
    ]
    h.sub.newApiKeyCreate.mockReset().mockResolvedValue({ sid: "SK-new", secret: "plain-key-secret" })
    h.sub.applicationsCreate.mockReset().mockResolvedValue({ sid: "AP-new" })
    h.sub.clientArgs = []
    clearCredentialsCache()
  })

  test("creates the key and TwiML App inside the subaccount when missing", async () => {
    await expect(ensureOrgVoiceCredentials(ORG)).resolves.toEqual({ apiKeySid: "SK-new", twimlAppSid: "AP-new" })
    // Client built from the SUBACCOUNT's own SID + token.
    expect(h.sub.clientArgs[0]).toEqual(["AC-sub", "sub-token"])
    expect(h.sub.newApiKeyCreate).toHaveBeenCalledWith({ accountSid: "AC-sub", friendlyName: "listhit-voice" })
    expect(h.sub.applicationsCreate).toHaveBeenCalledWith({
      friendlyName: "ListHit voice",
      voiceUrl: "https://app.listhit.test/api/webhooks/twilio-voice-twiml",
      voiceMethod: "POST",
    })
    const row = h.tables.org_twilio_credentials[0]
    expect(row.api_key_sid).toBe("SK-new")
    expect(row.api_key_secret_enc.startsWith("v1:")).toBe(true)
    expect(row.api_key_secret_enc).not.toContain("plain-key-secret")
    expect(row.twiml_app_sid).toBe("AP-new")
  })

  test("creates nothing when both already exist", async () => {
    Object.assign(h.tables.org_twilio_credentials[0], {
      api_key_sid: "SK-old",
      api_key_secret_enc: encryptSecret("old-secret"),
      twiml_app_sid: "AP-old",
    })
    await expect(ensureOrgVoiceCredentials(ORG)).resolves.toEqual({ apiKeySid: "SK-old", twimlAppSid: "AP-old" })
    expect(h.sub.newApiKeyCreate).not.toHaveBeenCalled()
    expect(h.sub.applicationsCreate).not.toHaveBeenCalled()
  })

  test("creates only the missing TwiML App", async () => {
    Object.assign(h.tables.org_twilio_credentials[0], {
      api_key_sid: "SK-old",
      api_key_secret_enc: encryptSecret("old-secret"),
    })
    await expect(ensureOrgVoiceCredentials(ORG)).resolves.toEqual({ apiKeySid: "SK-old", twimlAppSid: "AP-new" })
    expect(h.sub.newApiKeyCreate).not.toHaveBeenCalled()
    expect(h.sub.applicationsCreate).toHaveBeenCalledTimes(1)
  })

  test("throws when the org has no subaccount yet", async () => {
    h.tables.org_twilio_credentials = []
    await expect(ensureOrgVoiceCredentials(ORG)).rejects.toThrow(/subaccount first/)
  })
})
