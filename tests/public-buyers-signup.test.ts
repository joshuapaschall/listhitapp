import { NextRequest } from "next/server"

const fetchMock = vi.fn()
// @ts-ignore
global.fetch = fetchMock

const buyers: any[] = []
const consents: any[] = []
let idSeq = 1

const supabaseAdmin = {
  from: (table: string) => {
    if (table === "buyers") {
      return {
        select: () => {
          const state: any = { phoneNorm: null as string | null, emailNorm: null as string | null }
          const q: any = {
            eq(col: string, val: string) { if (col === "phone_norm") state.phoneNorm = val; return q },
            or(expr: string) { const m = expr.match(/email_norm\.eq\.([^,]+)/); if (m) state.emailNorm = decodeURIComponent(m[1]); return q },
            limit() { return q },
            async maybeSingle() { return { data: buyers.find((b) => b.phone_norm === state.phoneNorm || (state.emailNorm && b.email_norm === state.emailNorm)) || null, error: null } },
          }
          return q
        },
        update: (data: any) => ({ eq: (_: string, id: string) => ({ select: () => ({ single: async () => { const row = buyers.find((b) => b.id === id); Object.assign(row, data); return { data: row, error: null } } }) }) }),
        insert: (data: any) => ({ select: () => ({ single: async () => { const row = { id: `b${idSeq++}`, phone_norm: String(data.phone).replace(/^\+1/, ""), email_norm: (data.email || "").toLowerCase() || null, ...data }; buyers.push(row); return { data: row, error: null } } }) }),
      }
    }
    if (table === "buyer_consents") return { insert: async (data: any) => { consents.push(data); return { data, error: null } } }
    throw new Error("Unexpected table " + table)
  },
}

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin }))
vi.mock("@/lib/showing-notifications", () => ({ resolveFromNumber: vi.fn(async () => "+15550001111") }))

const { POST } = await import("../app/api/public/buyers/signup/route")
const mkReq = (body: any) => new NextRequest("http://localhost/api/public/buyers/signup", { method: "POST", headers: { origin: "https://georgiawholesalehomes.com", "x-forwarded-for": Math.random().toString(), "content-type": "application/json" }, body: JSON.stringify(body) })

const payload = {
  fname: "Josh",
  lname: "D",
  email: "j@x.com",
  phone: "(404) 555-1212",
  buyer_types: ["fix_flip"],
  payment_methods: ["cash"],
  property_types: ["Single Family"],
  locations: ["Fulton County (GA)"],
  consent_text: "I agree to receive recurring marketing autodialed SMS from Georgia Wholesale Homes and understand consent is not condition of purchase.",
}

describe("public buyers signup", () => {
  beforeEach(() => {
    buyers.length = 0
    consents.length = 0
    idSeq = 1
    fetchMock.mockReset().mockImplementation(async (url: string) => {
      if (url.includes("number_lookup")) return new Response(JSON.stringify({ data: { carrier: { type: "mobile", name: "x" } } }), { status: 200 })
      if (url.includes("debounce.io")) return new Response(JSON.stringify({ success: "1", debounce: { result: "Safe to Send", did_you_mean: "" } }), { status: 200 })
      return new Response("{}", { status: 200 })
    })
    process.env.TELNYX_API_KEY = "k"
    process.env.TELNYX_MESSAGING_PROFILE_ID = "mp"
    process.env.DEFAULT_OUTBOUND_DID = "+15550001111"
    process.env.DEBOUNCE_API_KEY = "d"
  })

  test("new buyer uses canonical tags", async () => {
    const res = await POST(mkReq(payload), { waitUntil: (p: Promise<any>) => p } as any)
    const json = await res.json()
    expect(json.is_new_buyer).toBe(true)
    expect(buyers[0].tags).toContain("Fix and Flips")
    expect(buyers[0].tags).toContain("Cash Buyer")
    expect(buyers[0].tags).not.toContain("website-signup")
  })

  test("existing buyer skips external validation and merges arrays", async () => {
    await POST(mkReq(payload), { waitUntil: (p: Promise<any>) => p } as any)
    const externalCallsAfterInsert = fetchMock.mock.calls.filter((c: any[]) => String(c[0]).includes("number_lookup") || String(c[0]).includes("debounce.io")).length
    const res = await POST(mkReq({ ...payload, locations: ["GA, USA"], property_types: ["Condo"] }), { waitUntil: (p: Promise<any>) => p } as any)
    expect((await res.json()).is_new_buyer).toBe(false)
    expect(buyers[0].locations).toEqual(["Fulton County (GA)", "GA, USA"])
    expect(buyers[0].property_type).toEqual(["Single Family", "Condo"])
    const externalCallsFinal = fetchMock.mock.calls.filter((c: any[]) => String(c[0]).includes("number_lookup") || String(c[0]).includes("debounce.io")).length
    expect(externalCallsFinal).toBe(externalCallsAfterInsert)
  })
})
