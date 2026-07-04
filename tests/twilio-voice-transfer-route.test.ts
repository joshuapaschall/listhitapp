const h = vi.hoisted(() => ({
  state: {
    user: { id: "u1" } as { id: string } | null,
    orgId: "org-1" as string | null,
    denied: null as any,
    call: null as any,
    calledSid: null as any,
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
    calls: (sid: string) => {
      h.state.calledSid = sid;
      return {
        update: async (opts: any) => {
          if (h.state.updateThrows) throw h.state.updateThrows;
          h.state.updateOpts = opts;
          return {};
        },
      };
    },
  }),
}));

import { POST } from "../app/api/twilio/voice-transfer/route";

function req(body: any) {
  return new Request("http://test/api/twilio/voice-transfer", {
    method: "POST",
    body: JSON.stringify(body),
  }) as any;
}

describe("twilio voice-transfer route", () => {
  beforeEach(() => {
    h.state.user = { id: "u1" };
    h.state.orgId = "org-1";
    h.state.denied = null;
    h.state.call = {
      call_sid: "CA-parent",
      far_leg_sid: "CA-far",
      direction: "outbound",
      status: "in-progress",
    };
    h.state.calledSid = null;
    h.state.updateOpts = null;
    h.state.updateThrows = null;
  });

  test("401 when there is no user", async () => {
    h.state.user = null;
    const res = await POST(req({ to: "+13335557777" }));
    expect(res.status).toBe(401);
  });

  test("400 when the destination is invalid", async () => {
    const res = await POST(req({ to: "nope" }));
    expect(res.status).toBe(400);
  });

  test("404 when there is no live call", async () => {
    h.state.call = null;
    const res = await POST(req({ to: "+13335557777" }));
    expect(res.status).toBe(404);
  });

  test("outbound → redirects the captured far-leg SID to the target", async () => {
    const res = await POST(req({ to: "3335557777" }));
    expect(res.status).toBe(200);
    expect(h.state.calledSid).toBe("CA-far");
    expect(h.state.updateOpts.twiml).toBe("<Response><Dial>+13335557777</Dial></Response>");
  });

  test("inbound → redirects the row's own call_sid (the caller)", async () => {
    h.state.call = { call_sid: "CA-inbound", far_leg_sid: null, direction: "inbound", status: "answered" };
    const res = await POST(req({ to: "+13335557777" }));
    expect(res.status).toBe(200);
    expect(h.state.calledSid).toBe("CA-inbound");
  });

  test("outbound with no captured far leg → 409", async () => {
    h.state.call = { call_sid: "CA-parent", far_leg_sid: null, direction: "outbound", status: "ringing" };
    const res = await POST(req({ to: "+13335557777" }));
    expect(res.status).toBe(409);
  });

  test("Twilio update throwing → 502", async () => {
    h.state.updateThrows = { message: "call not in progress", code: 21220 };
    const res = await POST(req({ to: "+13335557777" }));
    expect(res.status).toBe(502);
  });
});
