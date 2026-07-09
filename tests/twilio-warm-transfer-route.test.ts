const h = vi.hoisted(() => ({
  state: {
    user: { id: "u1" } as { id: string } | null,
    orgId: "org-1" as string | null,
    call: null as any,
    orgNumber: "+15551230000" as string | null,
    participantsList: [] as Array<{ callSid: string }>,
    // Recorded effects
    holdCalls: [] as Array<{ sid: string; hold: boolean }>,
    removedSids: [] as string[],
    createOpts: null as any,
    // Fault injection
    createThrows: null as any,
    updateThrows: null as any,
    listThrows: null as any,
    // What participants.create returns
    createdColleagueSid: "CA-colleague" as string,
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
vi.mock("@/lib/org-twilio/service", () => ({
  getOrgTwilio: async () => (h.state.orgNumber ? { phone_number: h.state.orgNumber } : null),
}));
vi.mock("@/lib/providers/twilio/client", () => {
  const participants = (sid: string) => ({
    update: async (opts: any) => {
      if (h.state.updateThrows) throw h.state.updateThrows;
      h.state.holdCalls.push({ sid, hold: opts.hold });
      return {};
    },
    remove: async () => {
      h.state.removedSids.push(sid);
      return {};
    },
  });
  (participants as any).create = async (opts: any) => {
    if (h.state.createThrows) throw h.state.createThrows;
    h.state.createOpts = opts;
    return { callSid: h.state.createdColleagueSid };
  };
  (participants as any).list = async () => {
    if (h.state.listThrows) throw h.state.listThrows;
    return h.state.participantsList;
  };
  return {
    getTwilioClient: () => ({
      conferences: (_confSid: string) => ({ participants }),
    }),
  };
});

import { POST } from "../app/api/twilio/warm-transfer/route";

function req(body: any) {
  return new Request("http://test/api/twilio/warm-transfer", {
    method: "POST",
    body: JSON.stringify(body),
  }) as any;
}

describe("twilio warm-transfer route", () => {
  beforeEach(() => {
    h.state.user = { id: "u1" };
    h.state.orgId = "org-1";
    h.state.orgNumber = "+15551230000";
    // Outbound: farParty = far_leg_sid ("CA-far"); agent leg = call_sid ("CA-agent").
    h.state.call = {
      call_sid: "CA-agent",
      far_leg_sid: "CA-far",
      direction: "outbound",
      status: "in-progress",
      conference_sid: "CF-1",
    };
    h.state.participantsList = [
      { callSid: "CA-far" },
      { callSid: "CA-agent" },
      { callSid: "CA-colleague" },
    ];
    h.state.holdCalls = [];
    h.state.removedSids = [];
    h.state.createOpts = null;
    h.state.createThrows = null;
    h.state.updateThrows = null;
    h.state.listThrows = null;
    h.state.createdColleagueSid = "CA-colleague";
  });

  test("401 when there is no user", async () => {
    h.state.user = null;
    const res = await POST(req({ action: "start", to: "+13335557777" }));
    expect(res.status).toBe(401);
  });

  test("400 on an unknown action", async () => {
    const res = await POST(req({ action: "bogus" }));
    expect(res.status).toBe(400);
  });

  test("404 when there is no live call", async () => {
    h.state.call = null;
    const res = await POST(req({ action: "start", to: "+13335557777" }));
    expect(res.status).toBe(404);
  });

  test("409 when the conference has not started", async () => {
    h.state.call = { ...h.state.call, conference_sid: null };
    const res = await POST(req({ action: "start", to: "+13335557777" }));
    expect(res.status).toBe(409);
  });

  // ---- start ----------------------------------------------------------------
  test("start: invalid number → 400", async () => {
    const res = await POST(req({ action: "start", to: "nope" }));
    expect(res.status).toBe(400);
  });

  test("start: 409 when the org has no Twilio number", async () => {
    h.state.orgNumber = null;
    const res = await POST(req({ action: "start", to: "+13335557777" }));
    expect(res.status).toBe(409);
  });

  test("start: holds the caller, dials the colleague, returns colleagueSid", async () => {
    const res = await POST(req({ action: "start", to: "3335557777" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.colleagueSid).toBe("CA-colleague");
    // Held the FAR party (the caller).
    expect(h.state.holdCalls).toEqual([{ sid: "CA-far", hold: true }]);
    // Dialed the colleague from the org number into the conference.
    expect(h.state.createOpts.from).toBe("+15551230000");
    expect(h.state.createOpts.to).toBe("+13335557777");
    expect(h.state.createOpts.label).toBe("warm-transfer");
  });

  test("start: when create throws → far party un-held and 502", async () => {
    h.state.createThrows = { message: "unreachable", code: 13224 };
    const res = await POST(req({ action: "start", to: "+13335557777" }));
    expect(res.status).toBe(502);
    // Held true then rolled back to false.
    expect(h.state.holdCalls).toEqual([
      { sid: "CA-far", hold: true },
      { sid: "CA-far", hold: false },
    ]);
  });

  // ---- complete -------------------------------------------------------------
  test("complete: missing colleagueSid → 400", async () => {
    const res = await POST(req({ action: "complete" }));
    expect(res.status).toBe(400);
  });

  test("complete: colleagueSid not in participants → 409", async () => {
    const res = await POST(req({ action: "complete", colleagueSid: "CA-ghost" }));
    expect(res.status).toBe(409);
  });

  test("complete: un-holds the caller and removes the AGENT (not caller, not colleague)", async () => {
    const res = await POST(req({ action: "complete", colleagueSid: "CA-colleague" }));
    expect(res.status).toBe(200);
    expect(h.state.holdCalls).toEqual([{ sid: "CA-far", hold: false }]);
    expect(h.state.removedSids).toEqual(["CA-agent"]);
    expect(h.state.removedSids).not.toContain("CA-colleague");
    expect(h.state.removedSids).not.toContain("CA-far");
  });

  // ---- cancel ---------------------------------------------------------------
  test("cancel: removes the COLLEAGUE and un-holds the caller", async () => {
    const res = await POST(req({ action: "cancel", colleagueSid: "CA-colleague" }));
    expect(res.status).toBe(200);
    expect(h.state.removedSids).toEqual(["CA-colleague"]);
    expect(h.state.holdCalls).toEqual([{ sid: "CA-far", hold: false }]);
  });

  test("cancel: an already-gone colleague still un-holds and returns ok", async () => {
    h.state.participantsList = [{ callSid: "CA-far" }, { callSid: "CA-agent" }];
    const res = await POST(req({ action: "cancel", colleagueSid: "CA-colleague" }));
    expect(res.status).toBe(200);
    // Not present → not removed, but caller is still un-held.
    expect(h.state.removedSids).toEqual([]);
    expect(h.state.holdCalls).toEqual([{ sid: "CA-far", hold: false }]);
  });
});
