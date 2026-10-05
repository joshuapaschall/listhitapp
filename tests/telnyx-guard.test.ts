// The pinned org is the single tenant that runs on Telnyx. Everything else is
// Twilio-only, so the guard is what stops a Telnyx-only route from reaching the
// Telnyx API on another tenant's behalf.

import {
  getPinnedTelnyxOrgIds,
  getPrimaryPinnedTelnyxOrgId,
  isOrgTelnyxPinnedEnv,
} from "@/lib/providers/sms/routing"
import { requireTelnyxPinnedOrg } from "@/lib/auth/telnyx-guard"

const ORG_A = "00000000-0000-4000-8000-00000000000a"
const ORG_B = "00000000-0000-4000-8000-00000000000b"

afterEach(() => {
  delete process.env.TELNYX_PINNED_ORG_IDS
})

describe("requireTelnyxPinnedOrg", () => {
  test("returns null for the pinned org", () => {
    process.env.TELNYX_PINNED_ORG_IDS = ORG_A
    expect(requireTelnyxPinnedOrg(ORG_A)).toBeNull()
  })

  test("403s a non-pinned org", async () => {
    process.env.TELNYX_PINNED_ORG_IDS = ORG_A
    const res = requireTelnyxPinnedOrg(ORG_B)
    expect(res?.status).toBe(403)
    await expect(res!.json()).resolves.toEqual({
      error: "This feature isn't available for your account.",
    })
  })

  test("403s a null org", () => {
    process.env.TELNYX_PINNED_ORG_IDS = ORG_A
    expect(requireTelnyxPinnedOrg(null)?.status).toBe(403)
    expect(requireTelnyxPinnedOrg(undefined)?.status).toBe(403)
  })

  test("403s everyone when nothing is pinned", () => {
    expect(requireTelnyxPinnedOrg(ORG_A)?.status).toBe(403)
  })
})

describe("getPrimaryPinnedTelnyxOrgId", () => {
  test("returns the single configured id", () => {
    process.env.TELNYX_PINNED_ORG_IDS = ` ${ORG_A} `
    expect(getPrimaryPinnedTelnyxOrgId()).toBe(ORG_A)
  })

  test("returns null when none are configured", () => {
    expect(getPrimaryPinnedTelnyxOrgId()).toBeNull()
    process.env.TELNYX_PINNED_ORG_IDS = ""
    expect(getPrimaryPinnedTelnyxOrgId()).toBeNull()
  })

  test("returns null when two are configured — the owner org is ambiguous", () => {
    process.env.TELNYX_PINNED_ORG_IDS = `${ORG_A},${ORG_B}`
    expect(getPrimaryPinnedTelnyxOrgId()).toBeNull()
  })
})

describe("env helpers", () => {
  test("parses and trims the pinned set", () => {
    process.env.TELNYX_PINNED_ORG_IDS = `${ORG_A}, ${ORG_B} ,`
    expect(getPinnedTelnyxOrgIds()).toEqual(new Set([ORG_A, ORG_B]))
  })

  test("isOrgTelnyxPinnedEnv is false for null/undefined", () => {
    process.env.TELNYX_PINNED_ORG_IDS = ORG_A
    expect(isOrgTelnyxPinnedEnv(null)).toBe(false)
    expect(isOrgTelnyxPinnedEnv(undefined)).toBe(false)
    expect(isOrgTelnyxPinnedEnv(ORG_A)).toBe(true)
    expect(isOrgTelnyxPinnedEnv(ORG_B)).toBe(false)
  })
})
