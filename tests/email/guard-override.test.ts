import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

// ---------------------------------------------------------------------------
// Chainable supabaseAdmin mock. Every builder method records its call and
// returns the same builder; terminal .maybeSingle()/.single() resolve to a
// per-test `mockResult`, and the builder is thenable so `await update().gt()`
// (clearGuardOverride) resolves too. `captured` records insert/update payloads.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => {
  const state = {
    result: { data: null as any, error: null as any },
    captured: [] as Array<{ m: string; args: any[] }>,
  }
  const makeBuilder = () => {
    const b: any = {}
    const chain = ["select", "gt", "order", "limit", "insert", "update", "eq"]
    for (const m of chain) {
      b[m] = (...args: any[]) => {
        state.captured.push({ m, args })
        return b
      }
    }
    b.maybeSingle = () => Promise.resolve(state.result)
    b.single = () => Promise.resolve(state.result)
    b.then = (res: any, rej: any) => Promise.resolve(state.result).then(res, rej)
    return b
  }
  const supabaseAdmin = { from: (_t: string) => makeBuilder() }
  return { state, supabaseAdmin }
})

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: h.supabaseAdmin }))

// createLogger returns a `debug` instance (callable, no `.error`) — mock it so
// the unit under test is isolated from the logger and the error path is exercised.
vi.mock("@/lib/logger", () => {
  const fn: any = () => {}
  fn.error = () => {}
  fn.info = () => {}
  fn.warn = () => {}
  return { createLogger: () => fn, logger: fn }
})

import {
  getActiveGuardOverride,
  isGuardOverrideActive,
  createGuardOverride,
  clearGuardOverride,
} from "@/lib/email/guard-override"

const setResult = (data: any, error: any = null) => {
  h.state.result = { data, error }
}
const capturedFor = (m: string) => h.state.captured.filter((c) => c.m === m)

beforeEach(() => {
  h.state.captured = []
  setResult(null, null)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("getActiveGuardOverride", () => {
  test("returns the row when override_until is in the future", async () => {
    const row = {
      id: "1",
      override_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      reason: "cleaned list",
      created_by: "user-1",
      created_at: new Date().toISOString(),
    }
    setResult(row)
    expect(await getActiveGuardOverride()).toEqual(row)
    // The query filters to non-expired rows.
    expect(capturedFor("gt").some((c) => c.args[0] === "override_until")).toBe(true)
  })

  test("returns null when there is no active override", async () => {
    setResult(null)
    expect(await getActiveGuardOverride()).toBeNull()
  })

  test("fails closed (returns null) on a query error", async () => {
    setResult(null, { message: "boom" })
    expect(await getActiveGuardOverride()).toBeNull()
  })
})

describe("isGuardOverrideActive", () => {
  test("true when an active row exists, false when none", async () => {
    setResult({ id: "1", override_until: new Date(Date.now() + 1000).toISOString() })
    expect(await isGuardOverrideActive()).toBe(true)
    setResult(null)
    expect(await isGuardOverrideActive()).toBe(false)
  })
})

describe("createGuardOverride clamps hours to 1–24", () => {
  const parseInserted = () => capturedFor("insert")[0]?.args[0]

  test("default/low values clamp up to at least 1 hour", async () => {
    vi.useFakeTimers()
    const now = new Date("2026-07-18T00:00:00.000Z")
    vi.setSystemTime(now)
    setResult({ id: "x" })

    await createGuardOverride({ hours: 0, reason: null, createdBy: "u" })
    const inserted = parseInserted()
    // 0 → default 2 → still >= 1; 2h from now.
    expect(inserted.override_until).toBe(new Date(now.getTime() + 2 * 3600_000).toISOString())
  })

  test("explicit 2 hours sets override_until = now + 2h", async () => {
    vi.useFakeTimers()
    const now = new Date("2026-07-18T00:00:00.000Z")
    vi.setSystemTime(now)
    setResult({ id: "x" })

    await createGuardOverride({ hours: 2, reason: "r", createdBy: "u" })
    expect(parseInserted().override_until).toBe(new Date(now.getTime() + 2 * 3600_000).toISOString())
  })

  test("above 24 clamps down to 24 hours", async () => {
    vi.useFakeTimers()
    const now = new Date("2026-07-18T00:00:00.000Z")
    vi.setSystemTime(now)
    setResult({ id: "x" })

    await createGuardOverride({ hours: 99, reason: null, createdBy: "u" })
    expect(parseInserted().override_until).toBe(new Date(now.getTime() + 24 * 3600_000).toISOString())
  })
})

describe("clearGuardOverride", () => {
  test("expires active rows by updating override_until, filtered to still-active rows", async () => {
    setResult(null)
    await clearGuardOverride()
    expect(capturedFor("update").length).toBe(1)
    expect(capturedFor("update")[0].args[0]).toHaveProperty("override_until")
    expect(capturedFor("gt").some((c) => c.args[0] === "override_until")).toBe(true)
  })
})

// The exact rule the send gate encodes: a frozen snapshot blocks sending only
// when no override is active. Verified against the real isGuardOverrideActive.
describe("gate rule: frozen && !override ⇒ block", () => {
  const wouldBlock = (frozen: boolean, overrideActive: boolean) => frozen && !overrideActive

  test("frozen + no override → blocks; frozen + override → sends", async () => {
    setResult(null) // no active override
    expect(wouldBlock(true, await isGuardOverrideActive())).toBe(true)

    setResult({ id: "1", override_until: new Date(Date.now() + 1000).toISOString() })
    expect(wouldBlock(true, await isGuardOverrideActive())).toBe(false)
  })

  test("not frozen → never blocks regardless of override", async () => {
    setResult(null)
    expect(wouldBlock(false, await isGuardOverrideActive())).toBe(false)
  })
})
