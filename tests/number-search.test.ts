// searchLocalNumbers widens until it finds something: area code (retried once)
// → overlay codes for the same metro → near the business phone → the state.
// The available-numbers route returns { results, matchedBy, searchedAreaCode }.

const h = vi.hoisted(() => ({
  responses: new Map<string, unknown[]>(),
  calls: [] as Record<string, unknown>[],
  orgRow: { phone: "(770) 555-0123", zip: "30060", state: "GA" } as Record<string, unknown>,
}))

vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: async () => ({ user: { id: "user-1" }, orgId: "44444444-4444-4444-8444-444444444444" }),
}))
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const q: any = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({
          data: table === "profiles" ? { role: "owner" } : table === "organizations" ? h.orgRow : null,
          error: null,
        }),
      }
      return q
    },
  },
}))
vi.mock("@/lib/twilio/parent", () => ({ getParentAccountClient: () => client }))

import { overlaysFor, searchLocalNumbers } from "@/lib/org-twilio/number-search"
import { GET } from "../app/api/org-twilio/numbers/available/route"

// Responses keyed by the search that produced them; a key may queue several
// responses (first call, retry, ...). Unlisted searches return nothing.
const keyOf = (p: Record<string, unknown>) =>
  p.areaCode ? `area:${p.areaCode}` : p.nearNumber ? `near:${p.nearNumber}` : p.inPostalCode ? `zip:${p.inPostalCode}` : p.inRegion ? `state:${p.inRegion}` : "?"
const queued = new Map<string, unknown[][]>()
const client: any = {
  availablePhoneNumbers: (_country: string) => ({
    local: {
      list: async (p: Record<string, unknown>) => {
        h.calls.push(p)
        const q = queued.get(keyOf(p))
        return q?.length ? q.shift()! : []
      },
    },
  }),
}
const on = (key: string, ...responses: unknown[][]) => queued.set(key, responses)
const num = (phoneNumber: string) => ({ phoneNumber, friendlyName: phoneNumber, locality: "Marietta", region: "GA" })

beforeEach(() => {
  queued.clear()
  h.calls = []
  h.orgRow = { phone: "(770) 555-0123", zip: "30060", state: "GA" }
  process.env.TELNYX_PINNED_ORG_IDS = "adddfd02-790e-4be7-a0df-047b7dbdd1b8"
})

describe("searchLocalNumbers", () => {
  test("an empty first attempt is retried once; the retry's results count as area_code", async () => {
    on("area:770", [], [num("+17703437886")])
    const out = await searchLocalNumbers(client, { areaCode: "770", limit: 10 })
    expect(out).toEqual({ results: [num("+17703437886")], matchedBy: "area_code" })
    expect(h.calls).toHaveLength(2)
    expect(h.calls[0]).toMatchObject({ areaCode: 770, smsEnabled: true, voiceEnabled: true, limit: 10 })
  })

  test("contains only narrows the area-code search", async () => {
    on("area:770", [num("+17705552020")])
    await searchLocalNumbers(client, { areaCode: "770", contains: "2020", limit: 10 })
    expect(h.calls[0]).toMatchObject({ areaCode: 770, contains: "2020" })
  })

  test("area code empty → the 678 overlay → overlay", async () => {
    on("area:678", [num("+16785550100")])
    const out = await searchLocalNumbers(client, { areaCode: "770", limit: 10 })
    expect(out.matchedBy).toBe("overlay")
    expect(out.results[0].phoneNumber).toBe("+16785550100")
    expect(h.calls.map((c) => c.areaCode)).toEqual([770, 770, 678])
    expect(h.calls.every((c) => c.smsEnabled === true && c.voiceEnabled === true)).toBe(true)
  })

  test("every code empty → nearby via the business phone", async () => {
    on("near:+17705550123", [num("+17705559999")])
    const out = await searchLocalNumbers(client, { areaCode: "770", nearPhone: "+17705550123", postalCode: "30060", state: "GA", limit: 10 })
    expect(out.matchedBy).toBe("nearby")
    expect(h.calls.at(-1)).toMatchObject({ nearNumber: "+17705550123", distance: 50 })
    expect(h.calls.map((c) => c.areaCode).filter(Boolean)).toEqual([770, 770, 678, 470, 404, 943])
  })

  test("no business phone → nearby by ZIP; then the state", async () => {
    on("state:GA", [num("+19125550100")])
    const out = await searchLocalNumbers(client, { areaCode: "770", postalCode: "30060", state: "ga", limit: 10 })
    expect(out.matchedBy).toBe("state")
    expect(h.calls).toContainEqual(expect.objectContaining({ inPostalCode: "30060", distance: 50 }))
    expect(h.calls.at(-1)).toMatchObject({ inRegion: "GA" })
  })

  test("everything empty → empty results, no throw", async () => {
    const out = await searchLocalNumbers(client, { areaCode: "770", nearPhone: "+17705550123", state: "GA", limit: 10 })
    expect(out.results).toEqual([])
  })

  test("overlay map is symmetric for Atlanta", () => {
    expect(overlaysFor("770")).toEqual(["678", "470", "404", "943"])
    expect(overlaysFor("404")).toEqual(["770", "678", "470", "943"])
    expect(overlaysFor("907")).toEqual([])
  })
})

describe("GET /api/org-twilio/numbers/available", () => {
  test("returns { results, matchedBy, searchedAreaCode }", async () => {
    on("area:678", [num("+16785550100")])
    const res = await GET(new Request("http://localhost/api/org-twilio/numbers/available?areaCode=770"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      results: [{ phoneNumber: "+16785550100", friendly: "+16785550100", locality: "Marietta", region: "GA" }],
      matchedBy: "overlay",
      searchedAreaCode: "770",
    })
  })

  test("the org's phone feeds the nearby step", async () => {
    on("near:+17705550123", [num("+17705559999")])
    const res = await GET(new Request("http://localhost/api/org-twilio/numbers/available?areaCode=770"))
    expect((await res.json()).matchedBy).toBe("nearby")
  })
})
