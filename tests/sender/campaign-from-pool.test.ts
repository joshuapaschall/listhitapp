import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

// ---------------------------------------------------------------------------
// supabaseAdmin mock for pickPoolFromNumber. The select chain ends on
// .maybeSingle(); the update chain ends by being awaited (thenable). We record
// every call so tests can assert the LRU query + the last_sms_at stamp.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => {
  const state = {
    selectResult: { data: null as any, error: null as any },
    updateResult: { error: null as any },
    calls: [] as Array<{ table: string; m: string; args: any[] }>,
  }
  const makeBuilder = (table: string) => {
    let isUpdate = false
    const b: any = {}
    const rec = (m: string, args: any[]) => {
      state.calls.push({ table, m, args })
    }
    for (const m of ["select", "eq", "order", "limit"]) {
      b[m] = (...args: any[]) => {
        rec(m, args)
        return b
      }
    }
    b.update = (...args: any[]) => {
      isUpdate = true
      rec("update", args)
      return b
    }
    b.maybeSingle = () => Promise.resolve(state.selectResult)
    b.then = (res: any, rej: any) =>
      Promise.resolve(isUpdate ? state.updateResult : state.selectResult).then(res, rej)
    return b
  }
  const supabaseAdmin = { from: (table: string) => makeBuilder(table) }
  return { state, supabaseAdmin }
})

vi.mock("@/lib/supabase", () => ({ supabaseAdmin: h.supabaseAdmin }))

import { pickPoolFromNumber, NoSendingPoolError } from "@/lib/sender/campaign-from-pool"
import { resolveSendingMarketId } from "@/lib/campaigns/resolve-sending-market"

const callsFor = (m: string) => h.state.calls.filter((c) => c.m === m)

beforeEach(() => {
  h.state.calls = []
  h.state.selectResult = { data: null, error: null }
  h.state.updateResult = { error: null }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("pickPoolFromNumber", () => {
  test("returns the LRU SMS-enabled+enabled number and stamps last_sms_at", async () => {
    h.state.selectResult = { data: { e164: "+14045551234", last_sms_at: null }, error: null }

    const result = await pickPoolFromNumber("org-1", "mkt-1")
    expect(result).toBe("+14045551234")

    // LRU query: org + market + sms_enabled + enabled, oldest last_sms_at first.
    expect(h.state.calls).toContainEqual({ table: "inbound_numbers", m: "eq", args: ["org_id", "org-1"] })
    expect(h.state.calls).toContainEqual({ table: "inbound_numbers", m: "eq", args: ["market_id", "mkt-1"] })
    expect(h.state.calls).toContainEqual({ table: "inbound_numbers", m: "eq", args: ["sms_enabled", true] })
    expect(h.state.calls).toContainEqual({ table: "inbound_numbers", m: "eq", args: ["enabled", true] })
    expect(h.state.calls).toContainEqual({
      table: "inbound_numbers",
      m: "order",
      args: ["last_sms_at", { ascending: true, nullsFirst: true }],
    })

    // Stamp: update last_sms_at on the chosen number, scoped by org + e164.
    const upd = callsFor("update")
    expect(upd).toHaveLength(1)
    expect(upd[0].args[0]).toHaveProperty("last_sms_at")
    expect(h.state.calls).toContainEqual({ table: "inbound_numbers", m: "eq", args: ["e164", "+14045551234"] })
  })

  test("empty pool → NoSendingPoolError, and no stamp is attempted", async () => {
    h.state.selectResult = { data: null, error: null }
    await expect(pickPoolFromNumber("org-1", "mkt-1")).rejects.toBeInstanceOf(NoSendingPoolError)
    expect(callsFor("update")).toHaveLength(0)
  })

  test("query error propagates", async () => {
    h.state.selectResult = { data: null, error: { message: "boom" } }
    await expect(pickPoolFromNumber("org-1", "mkt-1")).rejects.toMatchObject({ message: "boom" })
  })
})

// ---------------------------------------------------------------------------
// resolveSendingMarketId — fake client returning campaign-purpose market rows.
// ---------------------------------------------------------------------------

function makeMarketsClient(rows: Array<{ id: string }>) {
  const b: any = {}
  for (const m of ["select", "eq"]) b[m] = () => b
  b.then = (res: any, rej: any) => Promise.resolve({ data: rows, error: null }).then(res, rej)
  return { from: () => b } as any
}

describe("resolveSendingMarketId", () => {
  test("explicit valid campaign market id passes through", async () => {
    const client = makeMarketsClient([{ id: "a" }, { id: "b" }])
    expect(await resolveSendingMarketId(client, "org-1", "b")).toBe("b")
  })

  test("explicit id that isn't a campaign market throws", async () => {
    const client = makeMarketsClient([{ id: "a" }])
    await expect(resolveSendingMarketId(client, "org-1", "zzz")).rejects.toBeInstanceOf(NoSendingPoolError)
  })

  test("single campaign market auto-resolves with no explicit choice", async () => {
    const client = makeMarketsClient([{ id: "only" }])
    expect(await resolveSendingMarketId(client, "org-1", null)).toBe("only")
  })

  test("multiple campaign markets, none chosen → throws", async () => {
    const client = makeMarketsClient([{ id: "a" }, { id: "b" }])
    await expect(resolveSendingMarketId(client, "org-1", null)).rejects.toBeInstanceOf(NoSendingPoolError)
  })

  test("zero campaign markets → throws", async () => {
    const client = makeMarketsClient([])
    await expect(resolveSendingMarketId(client, "org-1", null)).rejects.toBeInstanceOf(NoSendingPoolError)
  })
})

// ---------------------------------------------------------------------------
// Sticky precedence: a per-buyer sticky number wins and the pool is NOT queried.
// ---------------------------------------------------------------------------

describe("resolveOutboundFrom sticky precedence", () => {
  test("a buyer_sms_senders sticky short-circuits before the pool", async () => {
    // A minimal client that returns a sticky from_number for buyer_sms_senders.
    const client: any = {
      from: (table: string) => {
        const b: any = {}
        for (const m of ["select", "eq", "order", "limit"]) b[m] = () => b
        b.maybeSingle = () =>
          Promise.resolve(
            table === "buyer_sms_senders"
              ? { data: { from_number: "+14045559999" }, error: null }
              : { data: null, error: null },
          )
        return b
      },
    }

    const { resolveOutboundFrom } = await import("@/lib/sender/sticky-sender")
    const result = await resolveOutboundFrom({
      client,
      buyerId: "buyer-1",
      threadId: null,
      explicitFrom: null,
      sendingMarketId: "mkt-1",
      orgId: "org-1",
    })

    expect(result).toBe("+14045559999")
    // The pool resolver hits supabaseAdmin.from("inbound_numbers"); it must NOT run.
    expect(h.state.calls.some((c) => c.table === "inbound_numbers")).toBe(false)
  })

  test("explicitFrom is only honored when org-scoped ownership matches", async () => {
    // The env fallback must not mask the fail-closed "should be null" cases.
    const savedDid = process.env.DEFAULT_OUTBOUND_DID
    delete process.env.DEFAULT_OUTBOUND_DID
    try {
      // voice_numbers returns a row ONLY when queried with the matching org_id.
      const makeClient = (): any => ({
        from: (table: string) => {
          const b: any = { __org: undefined as string | undefined }
          b.select = () => b
          b.eq = (col: string, val: any) => {
            if (col === "org_id") b.__org = val
            return b
          }
          b.in = () =>
            Promise.resolve(
              table === "voice_numbers" && b.__org === "org-1"
                ? { data: [{ phone_number: "+14045551234" }], error: null }
                : { data: [], error: null },
            )
          b.order = () => b
          b.limit = () => b
          b.maybeSingle = () => Promise.resolve({ data: null, error: null })
          return b
        },
      })

      const { resolveOutboundFrom } = await import("@/lib/sender/sticky-sender")

      // Correct org → honored.
      const ok = await resolveOutboundFrom({
        client: makeClient(),
        buyerId: null,
        threadId: null,
        explicitFrom: "+14045551234",
        orgId: "org-1",
      })
      expect(ok).toBe("+14045551234")

      // Wrong org → NOT honored (ownership query returns no rows), falls through
      // to the env default (unset in test) → null.
      const wrong = await resolveOutboundFrom({
        client: makeClient(),
        buyerId: null,
        threadId: null,
        explicitFrom: "+14045551234",
        orgId: "org-2",
      })
      expect(wrong).toBeNull()

      // No org → fail closed, explicit pick ignored entirely → null.
      const noOrg = await resolveOutboundFrom({
        client: makeClient(),
        buyerId: null,
        threadId: null,
        explicitFrom: "+14045551234",
        orgId: null,
      })
      expect(noOrg).toBeNull()
    } finally {
      if (savedDid === undefined) delete process.env.DEFAULT_OUTBOUND_DID
      else process.env.DEFAULT_OUTBOUND_DID = savedDid
    }
  })
})
