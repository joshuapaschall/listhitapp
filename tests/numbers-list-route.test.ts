// Regression tests for /api/numbers/list. This route used to call the Telnyx API
// (listPurchasedNumbersForOrigin) with the OWNER's key and return the account-wide
// inventory to any caller — unauthenticated and un-org-scoped. It now requires a
// session, resolves the caller's org, and returns only that org's numbers:
//  - Twilio-voice orgs → their own org_twilio.phone_number (never Telnyx inventory)
//  - Telnyx orgs       → their own inbound_numbers / voice_numbers rows (DB only)
const h = vi.hoisted(() => ({
  state: {
    user: { id: "u1" } as { id: string } | null,
    orgId: "org-1" as string | null,
    twilioRow: null as any,
    inbound: [] as any[],
    voice: [] as any[],
    eqCalls: {} as Record<string, Array<[string, any]>>,
  },
}));

// Assert the Telnyx account-wide inventory call is NEVER reachable from this route.
const telnyxInventoryMock = vi.hoisted(() => vi.fn(async () => []));
vi.mock("@/lib/telnyx/numbers", () => ({
  listPurchasedNumbersForOrigin: telnyxInventoryMock,
}));

vi.mock("@/lib/org-twilio/service", () => ({
  getOrgTwilio: async () => h.state.twilioRow,
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
        return resolve({ data: rows, error: null });
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

import { GET } from "../app/api/numbers/list/route";

describe("numbers-list route", () => {
  beforeEach(() => {
    h.state.user = { id: "u1" };
    h.state.orgId = "org-1";
    h.state.twilioRow = null;
    h.state.inbound = [];
    h.state.voice = [];
    h.state.eqCalls = {};
    telnyxInventoryMock.mockClear();
    // Pin a DIFFERENT org so the resolver never forces "telnyx" for our test orgs.
    process.env.TELNYX_PINNED_ORG_IDS = "00000000-0000-0000-0000-000000000000";
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

  test("Twilio-voice org returns its own number and never touches Telnyx inventory", async () => {
    h.state.twilioRow = { voice_provider: "twilio", phone_number: "+14705551234" };
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      items: [{ e164: "+14705551234", label: "Primary", verified: true, assignedToApp: true }],
      defaultFrom: "+14705551234",
    });
    expect(telnyxInventoryMock).not.toHaveBeenCalled();
  });

  test("Twilio-voice org with no phone_number returns empty, not a 500", async () => {
    h.state.twilioRow = { voice_provider: "twilio", phone_number: null };
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, items: [], defaultFrom: null });
    expect(telnyxInventoryMock).not.toHaveBeenCalled();
  });

  test("Telnyx org returns only THIS org's inbound numbers (never another tenant's)", async () => {
    h.state.twilioRow = null; // resolver → telnyx (default)
    h.state.inbound = [
      { e164: "+18110000000", org_id: "org-1", enabled: true },
      { e164: "+18220000000", org_id: "org-1", enabled: false }, // disabled — excluded
      { e164: "+19990000000", org_id: "org-2", enabled: true }, // other tenant — excluded
    ];
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([{ e164: "+18110000000" }]);
    expect(body.defaultFrom).toBe("+18110000000");
    expect(h.state.eqCalls.inbound_numbers).toContainEqual(["org_id", "org-1"]);
    expect(h.state.eqCalls.inbound_numbers).toContainEqual(["enabled", true]);
    expect(telnyxInventoryMock).not.toHaveBeenCalled();
  });

  test("Telnyx org falls back to org-scoped voice_numbers when inbound is empty", async () => {
    h.state.twilioRow = null;
    h.state.inbound = [{ e164: "+19990000000", org_id: "org-2", enabled: true }]; // other org → filtered out
    h.state.voice = [
      { phone_number: "+17010000000", org_id: "org-1" },
      { phone_number: "+17020000000", org_id: "org-2" }, // other tenant — excluded
    ];
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([{ e164: "+17010000000" }]);
    expect(body.defaultFrom).toBe("+17010000000");
    expect(h.state.eqCalls.voice_numbers).toContainEqual(["org_id", "org-1"]);
  });
});
