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
    // resolveSiteByHost queries site_domains/sites to scope the lead to an org.
    // georgiawholesalehomes.com is treated as a static/legacy origin, so no site
    // need resolve — return no match and the route falls back to the default org.
    if (table === "site_domains" || table === "sites") {
      const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: null, error: null }) }
      return q
    }
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

  // Step 1 carries both consent booleans; the base `payload` (no consent keys)
  // stands in for a Step-2 profile re-submit.
  const step1 = { ...payload, marketing_consent: true, nonmarketing_consent: true }
  const step1NoSms = { ...payload, marketing_consent: false, nonmarketing_consent: true }

  test("affirmative SMS marketing consent marks the lead textable", async () => {
    await POST(mkReq(step1), { waitUntil: (p: Promise<any>) => p } as any)
    expect(buyers[0].can_receive_sms).toBe(true)
  })

  test("unchecked SMS marketing consent leaves the lead not textable", async () => {
    await POST(mkReq(step1NoSms), { waitUntil: (p: Promise<any>) => p } as any)
    expect(buyers[0].can_receive_sms).toBe(false)
  })

  test("Step 2 re-submit writes no second consent row", async () => {
    await POST(mkReq(step1), { waitUntil: (p: Promise<any>) => p } as any)
    expect(consents.length).toBe(1)
    // Step 2 omits the consent booleans entirely → no consent event recorded.
    const res = await POST(mkReq(payload), { waitUntil: (p: Promise<any>) => p } as any)
    expect((await res.json()).is_new_buyer).toBe(false)
    expect(buyers.length).toBe(1)
    expect(consents.length).toBe(1)
  })

  test("re-submit does not re-subscribe, demote, or re-attribute an existing buyer", async () => {
    await POST(mkReq(step1), { waitUntil: (p: Promise<any>) => p } as any)
    // The buyer later opts out and is advanced/re-sourced by other systems.
    Object.assign(buyers[0], {
      can_receive_sms: false,
      can_receive_email: false,
      is_unsubscribed: true,
      status: "active",
      source: "manual_import",
    })
    await POST(mkReq(step1), { waitUntil: (p: Promise<any>) => p } as any)
    expect(buyers.length).toBe(1)
    expect(buyers[0].can_receive_sms).toBe(false)
    expect(buyers[0].can_receive_email).toBe(false)
    expect(buyers[0].is_unsubscribed).toBe(true)
    expect(buyers[0].status).toBe("active")
    expect(buyers[0].source).toBe("manual_import")
  })

  test("re-submit without a price band preserves a previously-saved range", async () => {
    await POST(mkReq({ ...step1, asking_price_min: 100000, asking_price_max: 200000 }), { waitUntil: (p: Promise<any>) => p } as any)
    expect(buyers[0].asking_price_min).toBe(100000)
    expect(buyers[0].asking_price_max).toBe(200000)
    // Step 2 carries no price band → saved range must survive.
    await POST(mkReq(payload), { waitUntil: (p: Promise<any>) => p } as any)
    expect(buyers[0].asking_price_min).toBe(100000)
    expect(buyers[0].asking_price_max).toBe(200000)
  })
})
