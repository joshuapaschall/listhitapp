const h = vi.hoisted(() => ({
  state: {
    user: { id: "u1" } as { id: string } | null,
    orgId: "org-1" as string | null,
    rows: [] as any[],
  },
}));

vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: async () => ({
    user: h.state.user,
    orgId: h.state.orgId,
    supabase: {
      from: () => ({
        select: () => ({
          gte: () => ({ lt: async () => ({ data: h.state.rows, error: null }) }),
        }),
      }),
    },
  }),
}));

import { GET } from "../app/api/calls/stats/route";

describe("calls stats route (Twilio + Telnyx parity)", () => {
  beforeEach(() => {
    h.state.user = { id: "u1" };
    h.state.orgId = "org-1";
    h.state.rows = [];
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

  test("counts Twilio + Telnyx statuses the same for connected / talk-time / missed / voicemail", async () => {
    h.state.rows = [
      // Twilio
      { status: "completed", duration_seconds: 60, voicemail: false, voicemail_storage_path: null }, // connected
      { status: "in-progress", duration_seconds: 30, voicemail: false }, // connected (live)
      { status: "no-answer", duration_seconds: null, voicemail: false }, // missed (hyphen)
      { status: "voicemail", duration_seconds: null, voicemail: true, voicemail_storage_path: "2026/07/x.mp3" }, // voicemail
      { status: "busy", duration_seconds: null, voicemail: false }, // missed
      // Telnyx
      { status: "answered", duration_seconds: 40, voicemail: false }, // connected
      { status: "no_answer", duration_seconds: null, voicemail: false }, // missed (underscore)
    ];

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    const s = body.stats;

    expect(s.callsToday).toBe(7);
    // connected: completed(60) + in-progress(30) + answered(40) = 3 legs, 130s talk time
    expect(s.talkTimeTodaySeconds).toBe(130);
    expect(s.connectedRateToday).toBeCloseTo(3 / 7);
    // missed: no-answer + busy + no_answer = 3
    expect(s.missedToday).toBe(3);
    expect(s.newVoicemails).toBe(1);
  });
});
