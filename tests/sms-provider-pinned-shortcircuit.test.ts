// The owner (pinned) org must resolve to Telnyx before ANY database read, so a
// database hiccup can never block the owner's phone system.
const ORG = "adddfd02-790e-4be7-a0df-047b7dbdd1b8"

const db = vi.hoisted(() => ({ calls: 0 }))

vi.mock("@/lib/supabase", () => {
  const from = () => {
    db.calls += 1
    throw new Error("database must not be touched for the pinned org")
  }
  return { supabaseAdmin: { from }, supabase: { from } }
})
vi.mock("@/lib/supabase/admin", () => {
  const from = () => {
    db.calls += 1
    throw new Error("database must not be touched for the pinned org")
  }
  return { supabaseAdmin: { from } }
})
vi.mock("@/lib/twilio/org-client", () => ({
  getTwilioClientForOrg: vi.fn(() => {
    throw new Error("no Twilio client for the owner org")
  }),
}))

import { getSmsReadiness, resolveSmsProvider, TelnyxSmsProvider } from "@/lib/providers/sms"
import { loadRoutingState } from "@/lib/providers/routing-state"

describe("pinned org short-circuit", () => {
  beforeEach(() => {
    db.calls = 0
    process.env.TELNYX_PINNED_ORG_IDS = ORG
  })

  test("resolveSmsProvider → TelnyxSmsProvider with zero database calls", async () => {
    const provider = await resolveSmsProvider(ORG)
    expect(provider).toBeInstanceOf(TelnyxSmsProvider)
    expect(db.calls).toBe(0)
  })

  test("getSmsReadiness → telnyx with zero database calls", async () => {
    await expect(getSmsReadiness(ORG)).resolves.toBe("telnyx")
    expect(db.calls).toBe(0)
  })

  test("loadRoutingState → null with zero database calls", async () => {
    await expect(loadRoutingState(ORG)).resolves.toBeNull()
    expect(db.calls).toBe(0)
  })
})
