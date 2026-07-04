const h = vi.hoisted(() => ({
  state: {
    user: { id: "u1" } as { id: string } | null,
    orgId: "org-1" as string | null,
    call: null as any,
    confSid: null as any,
    partSid: null as any,
    updateOpts: null as any,
    updateThrows: null as any,
  },
}));

vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: async () => ({ user: h.state.user, orgId: h.state.orgId, supabase: {} }),
}));
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "calls") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: () => ({
                  order: () => ({
                    limit: () => ({ maybeSingle: async () => ({ data: h.state.call, error: null }) }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  },
  supabase: {},
}));
vi.mock("@/lib/providers/twilio/client", () => ({
  getTwilioClient: () => ({
    conferences: (confSid: string) => {
      h.state.confSid = confSid;
      return {
        participants: (partSid: string) => {
          h.state.partSid = partSid;
          return {
            update: async (opts: any) => {
              if (h.state.updateThrows) throw h.state.updateThrows;
              h.state.updateOpts = opts;
              return {};
            },
          };
        },
      };
    },
  }),
}));

import { POST } from "../app/api/twilio/voice-hold/route";

function req(body: any) {
  return new Request("http://test/api/twilio/voice-hold", {
    method: "POST",
    body: JSON.stringify(body),
  }) as any;
}

describe("twilio voice-hold route", () => {
  beforeEach(() => {
    h.state.user = { id: "u1" };
    h.state.orgId = "org-1";
    h.state.call = {
      call_sid: "CA-caller",
      far_leg_sid: "CA-far",
      direction: "outbound",
      status: "in-progress",
      conference_sid: "CF123",
    };
    h.state.confSid = null;
    h.state.partSid = null;
    h.state.updateOpts = null;
    h.state.updateThrows = null;
  });

  test("401 when there is no user", async () => {
    h.state.user = null;
    const res = await POST(req({ hold: true }));
    expect(res.status).toBe(401);
  });

  test("400 when hold is missing / not a boolean", async () => {
    expect((await POST(req({}))).status).toBe(400);
    expect((await POST(req({ hold: "yes" }))).status).toBe(400);
  });

  test("404 when there is no live call", async () => {
    h.state.call = null;
    const res = await POST(req({ hold: true }));
    expect(res.status).toBe(404);
  });

  test("409 when the call is not connected yet (no conference_sid)", async () => {
    h.state.call = { ...h.state.call, conference_sid: null };
    const res = await POST(req({ hold: true }));
    expect(res.status).toBe(409);
  });

  test("409 when the outbound far leg is not captured", async () => {
    h.state.call = { ...h.state.call, far_leg_sid: null };
    const res = await POST(req({ hold: true }));
    expect(res.status).toBe(409);
  });

  test("outbound → holds the far (prospect) participant in the conference", async () => {
    const res = await POST(req({ hold: true }));
    expect(res.status).toBe(200);
    expect(h.state.confSid).toBe("CF123");
    expect(h.state.partSid).toBe("CA-far");
    expect(h.state.updateOpts).toEqual({ hold: true });
    const body = await res.json();
    expect(body).toEqual({ ok: true, hold: true });
  });

  test("inbound → holds the caller participant (row's own call_sid)", async () => {
    h.state.call = { call_sid: "CA-inbound", far_leg_sid: null, direction: "inbound", status: "in-progress", conference_sid: "CF9" };
    const res = await POST(req({ hold: true }));
    expect(res.status).toBe(200);
    expect(h.state.confSid).toBe("CF9");
    expect(h.state.partSid).toBe("CA-inbound");
  });

  test("hold:false resumes the participant", async () => {
    const res = await POST(req({ hold: false }));
    expect(res.status).toBe(200);
    expect(h.state.updateOpts).toEqual({ hold: false });
  });

  test("Twilio update throwing → 502", async () => {
    h.state.updateThrows = { message: "conference not found", code: 20404 };
    const res = await POST(req({ hold: true }));
    expect(res.status).toBe(502);
  });
});
