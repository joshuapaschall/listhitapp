// A published site on a CUSTOM domain is neither a static origin nor a tenant
// subdomain, so its analytics beacon used to be rejected outright — the tenant
// simply got no pageview data.

import { NextRequest } from "next/server"

const state = vi.hoisted(() => ({
  // host -> site row
  sites: {} as Record<string, { id: string; org_id: string } | undefined>,
  inserts: [] as any[],
}))

vi.mock("@/lib/site-builder/resolve-site", () => ({
  resolveSiteByHost: async (host: string) => state.sites[host] ?? null,
}))

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== "site_events") throw new Error(`Unexpected table ${table}`)
      return {
        insert: async (row: any) => {
          state.inserts.push(row)
          return { error: null }
        },
      }
    },
  },
}))

import { OPTIONS, POST } from "../app/api/public/site-events/route"

const CUSTOM = "https://deals.northwind.test"
const UNKNOWN = "https://evil.test"

function beacon(origin: string) {
  return new NextRequest("http://test/api/public/site-events", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0",
      // Unique per call so the rate limiter doesn't interfere.
      "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250) + 1}`,
    },
    body: JSON.stringify({ path: "/listings", visitor_id: "v1" }),
  })
}

describe("site-events on a custom domain", () => {
  beforeEach(() => {
    state.sites = { "deals.northwind.test": { id: "site-1", org_id: "org-1" } }
    state.inserts = []
  })

  test("POST from a resolving custom domain → 204 and the event is inserted", async () => {
    const res = await POST(beacon(CUSTOM))

    expect(res.status).toBe(204)
    expect(state.inserts).toHaveLength(1)
    expect(state.inserts[0]).toEqual(
      expect.objectContaining({
        site_id: "site-1",
        org_id: "org-1",
        type: "pageview",
        path: "/listings",
      }),
    )
  })

  test("OPTIONS from a resolving custom domain → 204 with CORS", async () => {
    const res = await OPTIONS(
      new NextRequest("http://test/api/public/site-events", {
        method: "OPTIONS",
        headers: { origin: CUSTOM },
      }),
    )

    expect(res.status).toBe(204)
    expect(res.headers.get("access-control-allow-origin")).toBe(CUSTOM)
  })

  test("an unknown origin is still rejected", async () => {
    const res = await POST(beacon(UNKNOWN))

    expect(res.status).toBe(403)
    expect(state.inserts).toHaveLength(0)
  })

  test("OPTIONS from an unknown origin → 403", async () => {
    const res = await OPTIONS(
      new NextRequest("http://test/api/public/site-events", {
        method: "OPTIONS",
        headers: { origin: UNKNOWN },
      }),
    )

    expect(res.status).toBe(403)
  })

  test("a custom domain whose site was unpublished is rejected", async () => {
    state.sites = {}
    const res = await POST(beacon(CUSTOM))

    expect(res.status).toBe(403)
    expect(state.inserts).toHaveLength(0)
  })

  test("bots are dropped silently rather than recorded", async () => {
    const req = new NextRequest("http://test/api/public/site-events", {
      method: "POST",
      headers: {
        origin: CUSTOM,
        "content-type": "application/json",
        "user-agent": "Googlebot/2.1",
        "x-forwarded-for": "10.1.2.3",
      },
      body: JSON.stringify({ path: "/" }),
    })

    const res = await POST(req)
    expect(res.status).toBe(204)
    expect(state.inserts).toHaveLength(0)
  })
})
