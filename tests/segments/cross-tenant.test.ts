// Cross-tenant isolation: the engine must resolve ONLY the requesting org's
// buyers, even when another org has buyers that would match the same definition.
import { resolveSegment } from "@/lib/segments/resolver"
import type { ResolveContext, SegmentDefinition } from "@/lib/segments/types"

interface QueryState {
  table: string
  calls: { m: string; args: any[] }[]
}

// Buyers across two orgs. org B has a "cash" buyer that WOULD match defA.
const POOL = [
  { id: "A1", org_id: "A", tags: ["cash"], deleted_at: null, email_suppressed: false, can_receive_email: true, email: "a1@x.com" },
  { id: "A2", org_id: "A", tags: ["other"], deleted_at: null, email_suppressed: false, can_receive_email: true, email: "a2@x.com" },
  { id: "B1", org_id: "B", tags: ["cash"], deleted_at: null, email_suppressed: false, can_receive_email: true, email: "b1@x.com" },
]

// Apply the recorded eq/is/not/overlaps filters to the pool, simulating the DB.
function applyFilters(state: QueryState) {
  let out: any[] = POOL
  for (const c of state.calls) {
    if (c.m === "eq") out = out.filter((r) => r[c.args[0]] === c.args[1])
    else if (c.m === "is") out = out.filter((r) => r[c.args[0]] === c.args[1])
    else if (c.m === "not" && c.args[1] === "is" && c.args[2] === null) out = out.filter((r) => r[c.args[0]] != null)
    else if (c.m === "overlaps") {
      const vals: string[] = c.args[1]
      out = out.filter((r) => Array.isArray(r[c.args[0]]) && r[c.args[0]].some((v: string) => vals.includes(v)))
    }
  }
  return out.map((r) => ({ id: r.id }))
}

function makeClient() {
  const client = {
    from: (table: string) => {
      const state: QueryState = { table, calls: [] }
      const q: any = {}
      for (const m of ["select", "eq", "is", "not", "overlaps", "in", "order", "gte", "lte"]) {
        q[m] = (...args: any[]) => {
          state.calls.push({ m, args })
          return q
        }
      }
      q.range = () => Promise.resolve({ data: table === "buyers" ? applyFilters(state) : [], error: null })
      q.limit = () => Promise.resolve({ data: table === "buyers" ? applyFilters(state) : [], error: null })
      return q
    },
  }
  return client
}

const ctx = (orgId: string): ResolveContext => ({ supabase: makeClient(), orgId, channel: "email" })
const DEF_CASH: SegmentDefinition = {
  match: "all",
  conditions: [{ kind: "attribute", field: "tags", operator: "contains", value: ["cash"] }],
}

describe("cross-tenant isolation", () => {
  test("org A resolution returns only org A buyers, never org B's matching buyer", async () => {
    const result = await resolveSegment(DEF_CASH, ctx("A"))
    expect([...result]).toEqual(["A1"])
    expect(result.has("B1")).toBe(false) // org B "cash" buyer is excluded
  })

  test("the same definition under org B returns only org B's buyer", async () => {
    const result = await resolveSegment(DEF_CASH, ctx("B"))
    expect([...result]).toEqual(["B1"])
    expect(result.has("A1")).toBe(false)
  })

  test("eligible universe is org-scoped too (empty definition → only the org's buyers)", async () => {
    const a = await resolveSegment({ match: "all", conditions: [] }, ctx("A"))
    expect([...a].sort()).toEqual(["A1", "A2"]) // both org A, email-eligible
    expect(a.has("B1")).toBe(false)
  })
})
