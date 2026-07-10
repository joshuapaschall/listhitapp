// Regression tests for /api/voice-numbers org scoping. The route resolved orgId
// but never filtered by it, leaking every org's DIDs; both reads must now be
// scoped to the caller's org.
const h = vi.hoisted(() => ({
  state: {
    user: { id: "u1" } as { id: string } | null,
    orgId: "org-1" as string | null,
    inbound: [] as any[],
    voice: [] as any[],
    inboundError: null as any,
    voiceError: null as any,
    eqCalls: {} as Record<string, Array<[string, any]>>,
  },
}));

vi.mock("@/lib/auth/org-context", () => {
  // Minimal chainable that filters seeded rows by each .eq() and records the
  // (column, value) pairs so tests can assert org scoping.
  const chainable = (table: string) => {
    let rows = (table === "inbound_numbers" ? h.state.inbound : h.state.voice).slice();
    const applied: Array<[string, any]> = [];
    const q: any = {
      select: () => q,
      eq: (col: string, val: any) => {
        applied.push([col, val]);
        rows = rows.filter((r: any) => r[col] === val);
        return q;
      },
      then: (resolve: any) => {
        h.state.eqCalls[table] = applied;
        const error = table === "inbound_numbers" ? h.state.inboundError : h.state.voiceError;
        return resolve({ data: error ? null : rows, error });
      },
    };
    return q;
  };
  return {
    requireOrgContext: async () => ({
      user: h.state.user,
      orgId: h.state.orgId,
      supabase: { from: (t: string) => chainable(t) },
    }),
  };
});

import { GET } from "../app/api/voice-numbers/route";

describe("voice-numbers route", () => {
  beforeEach(() => {
    h.state.user = { id: "u1" };
    h.state.orgId = "org-1";
    h.state.inbound = [];
    h.state.voice = [];
    h.state.inboundError = null;
    h.state.voiceError = null;
    h.state.eqCalls = {};
  });

  test("401 when there is no user", async () => {
    h.state.user = null;
    const res = await GET();
    expect(res.status).toBe(401);
  });

  test("400 when there is no org", async () => {
    h.state.orgId = null;
    const res = await GET();
    expect(res.status).toBe(400);
  });

  test("inbound query is scoped by org_id AND enabled, returning only this org's DIDs", async () => {
    h.state.inbound = [
      { e164: "+18110000000", org_id: "org-1", enabled: true },
      { e164: "+18220000000", org_id: "org-1", enabled: false }, // disabled — excluded
      { e164: "+19990000000", org_id: "org-2", enabled: true }, // other tenant — excluded
    ];
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.numbers).toEqual(["+18110000000"]);
    expect(h.state.eqCalls.inbound_numbers).toContainEqual(["org_id", "org-1"]);
    expect(h.state.eqCalls.inbound_numbers).toContainEqual(["enabled", true]);
  });

  test("falls back to voice_numbers (org-scoped) when inbound is empty", async () => {
    h.state.inbound = [{ e164: "+19990000000", org_id: "org-2", enabled: true }]; // other org only → filtered to empty
    h.state.voice = [
      { phone_number: "+17010000000", org_id: "org-1" },
      { phone_number: "+17020000000", org_id: "org-2" }, // other tenant — excluded
    ];
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.numbers).toEqual(["+17010000000"]);
    expect(h.state.eqCalls.voice_numbers).toContainEqual(["org_id", "org-1"]);
  });

  test("never surfaces another org's numbers from either table", async () => {
    h.state.inbound = [{ e164: "+19990000000", org_id: "org-2", enabled: true }];
    h.state.voice = [{ phone_number: "+17020000000", org_id: "org-2" }];
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.numbers).toEqual([]);
  });

  test("500 when the voice_numbers fallback query errors", async () => {
    h.state.inbound = [];
    h.state.voiceError = { message: "db fail" };
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
