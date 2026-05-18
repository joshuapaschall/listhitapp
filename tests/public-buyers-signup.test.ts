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
            async maybeSingle() {
              return { data: buyers.find((b) => b.phone_norm === state.phoneNorm || (state.emailNorm && b.email_norm === state.emailNorm)) || null, error: null }
            },
          }
          return q
        },
        update: (data: any) => ({
          eq: (_: string, id: string) => ({
            select: () => ({
              single: async () => {
                const row = buyers.find((b) => b.id === id)
                Object.assign(row, data)
                return { data: row, error: null }
              },
            }),
          }),
        }),
        insert: (data: any) => ({
          select: () => ({
            single: async () => {
              const row = { id: `b${idSeq++}`, phone_norm: String(data.phone).replace(/^\+1/, ""), email_norm: (data.email || "").toLowerCase() || null, ...data }
              buyers.push(row)
              return { data: row, error: null }
            },
          }),
        }),
      }
    }
    if (table === "buyer_consents") {
      return { insert: async (data: any) => { consents.push(data); return { data, error: null } } }
    }
    throw new Error("Unexpected table " + table)
  },
}

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin }))
vi.mock("@/lib/showing-notifications", () => ({ resolveFromNumber: vi.fn(async () => "+15550001111") }))

const mod = await import("../app/api/public/buyers/signup/route")
const { POST, OPTIONS } = mod

const mkReq = (body: any, origin = "https://georgiawholesalehomes.com", ip = Math.random().toString()) => new NextRequest("http://localhost/api/public/buyers/signup", { method: "POST", headers: { origin, "x-forwarded-for": ip, "content-type": "application/json" }, body: JSON.stringify(body) })

const payload = {
  fname: "Josh",
  lname: "D",
  email: "j@x.com",
  phone: "(404) 555-1212",
  buyer_type: "fix_flip",
  consent_text: "I agree to receive recurring marketing autodialed SMS from Georgia Wholesale Homes and understand consent is not condition of purchase.",
  source_url: "https://georgiawholesalehomes.com",
}

describe("public buyers signup", () => {
  beforeEach(() => {
    buyers.length = 0
    consents.length = 0
    idSeq = 1
    fetchMock.mockReset().mockResolvedValue(new Response("{}", { status: 200 }))
    process.env.TELNYX_API_KEY = "k"
    process.env.TELNYX_MESSAGING_PROFILE_ID = "mp"
    process.env.DEFAULT_OUTBOUND_DID = "+15550001111"
  })

  test("valid new signup creates buyer consent and sms", async () => {
    const res = await POST(mkReq(payload), { waitUntil: (p: Promise<any>) => p } as any)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.is_new_buyer).toBe(true)
    expect(consents.length).toBe(1)
  })

  test("duplicate phone updates existing buyer", async () => {
    await POST(mkReq(payload), { waitUntil: (p: Promise<any>) => p } as any)
    const res2 = await POST(mkReq({ ...payload, fname: "Updated", email: "new@x.com" }), { waitUntil: (p: Promise<any>) => p } as any)
    const json2 = await res2.json()
    expect(json2.is_new_buyer).toBe(false)
    expect(buyers.length).toBe(1)
    expect(buyers[0].fname).toBe("Updated")
  })

  test("duplicate email updates existing buyer", async () => {
    await POST(mkReq(payload), { waitUntil: (p: Promise<any>) => p } as any)
    const res = await POST(mkReq({ ...payload, phone: "4045552222" }), { waitUntil: (p: Promise<any>) => p } as any)
    expect((await res.json()).is_new_buyer).toBe(false)
  })

  test("missing fname invalid_body", async () => {
    const res = await POST(mkReq({ ...payload, fname: "" }), { waitUntil: (p: Promise<any>) => p } as any)
    expect(res.status).toBe(400)
    expect((await res.json()).error_code).toBe("invalid_body")
  })

  test("invalid phone", async () => {
    const res = await POST(mkReq({ ...payload, phone: "123" }), { waitUntil: (p: Promise<any>) => p } as any)
    expect(res.status).toBe(400)
    expect((await res.json()).error_code).toBe("invalid_phone")
  })

  test("disallowed origin", async () => {
    const res = await POST(mkReq(payload, "https://evil.com"), { waitUntil: (p: Promise<any>) => p } as any)
    expect(res.status).toBe(403)
    expect((await res.json()).error_code).toBe("origin_not_allowed")
  })

  test("rate limit", async () => {
    for (let i = 0; i < 5; i++) await POST(mkReq({ ...payload, email: `a${i}@x.com` }, "https://georgiawholesalehomes.com", "9.9.9.9"), { waitUntil: (p: Promise<any>) => p } as any)
    const res = await POST(mkReq({ ...payload, email: "a6@x.com" }, "https://georgiawholesalehomes.com", "9.9.9.9"), { waitUntil: (p: Promise<any>) => p } as any)
    expect(res.status).toBe(429)
    expect((await res.json()).error_code).toBe("rate_limited")
  })

  test("options preflight", async () => {
    const req = new NextRequest("http://localhost", { method: "OPTIONS", headers: { origin: "https://georgiawholesalehomes.com" } })
    const res = await OPTIONS(req)
    expect(res.status).toBe(204)
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS")
  })

  test("unsubscribed reset", async () => {
    const first = await POST(mkReq(payload), { waitUntil: (p: Promise<any>) => p } as any)
    const id = (await first.json()).buyer_id
    const row = buyers.find((b) => b.id === id)
    row.is_unsubscribed = true
    await POST(mkReq({ ...payload, fname: "Again" }), { waitUntil: (p: Promise<any>) => p } as any)
    expect(row.is_unsubscribed).toBe(false)
  })
})
