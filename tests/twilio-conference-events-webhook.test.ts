import { NextRequest } from "next/server";

const h = vi.hoisted(() => {
  const state = { row: null as any, updates: null as any, updatedId: null as any };
  const client = {
    from: (table: string) => {
      if (table === "calls") {
        return {
          select: () => ({
            eq: (_col: string, val: any) => {
              state.updatedId = null;
              return { maybeSingle: async () => ({ data: state.row, error: null }) };
            },
          }),
          update: (u: any) => {
            state.updates = u;
            return {
              eq: async (_col: string, val: any) => {
                state.updatedId = val;
                return { error: null };
              },
            };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
  return { state, client, validateMock: vi.fn(() => true) };
});

vi.mock("twilio", async (importOriginal) => {
  const actual: any = await importOriginal();
  const d = actual.default;
  return { ...actual, default: { ...d, validateRequest: h.validateMock } };
});
vi.mock("@/lib/supabase", () => ({ supabase: h.client, supabaseAdmin: h.client }));

const { POST } = await import("../app/api/webhooks/twilio-conference-events/route");

function req(fields: Record<string, string>, ref?: string) {
  const url = ref
    ? `http://test/api/webhooks/twilio-conference-events?ref=${encodeURIComponent(ref)}`
    : "http://test/api/webhooks/twilio-conference-events";
  return new NextRequest(url, {
    method: "POST",
    body: new URLSearchParams(fields).toString(),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": "sig",
    },
  });
}

describe("twilio conference events webhook", () => {
  beforeEach(() => {
    h.validateMock.mockReset().mockReturnValue(true);
    h.state.row = { id: "c1", ended_at: null };
    h.state.updates = null;
    h.state.updatedId = null;
    process.env.NEXT_PUBLIC_BASE_URL = "https://app.listhit.io";
    process.env.LISTHIT_TWILIO_AUTH_TOKEN = "AUTH";
  });

  test("bad signature → 403", async () => {
    h.validateMock.mockReturnValue(false);
    const res = await POST(req({ StatusCallbackEvent: "conference-start", ConferenceSid: "CF1" }, "CA-agent"));
    expect(res.status).toBe(403);
    expect(h.state.updates).toBeNull();
  });

  test("conference-start sets conference_sid", async () => {
    const res = await POST(req({ StatusCallbackEvent: "conference-start", ConferenceSid: "CF1" }, "CA-agent"));
    expect(res.status).toBe(204);
    expect(h.state.updatedId).toBe("c1");
    expect(h.state.updates).toEqual({ conference_sid: "CF1" });
  });

  test("conference-end fills ended_at only when null", async () => {
    const res = await POST(req({ StatusCallbackEvent: "conference-end", ConferenceSid: "CF1" }, "CA-agent"));
    expect(res.status).toBe(204);
    expect(typeof h.state.updates.ended_at).toBe("string");
  });

  test("conference-end does NOT overwrite an existing ended_at", async () => {
    h.state.row = { id: "c1", ended_at: "2020-01-01T00:00:00Z" };
    const res = await POST(req({ StatusCallbackEvent: "conference-end", ConferenceSid: "CF1" }, "CA-agent"));
    expect(res.status).toBe(204);
    expect(h.state.updates).toBeNull();
  });

  // --- V4: inbound disposition + duration on conference-end ---
  test("conference-end on an answered inbound row → completed + duration_seconds (from payload Duration)", async () => {
    h.state.row = {
      id: "c1",
      ended_at: null,
      status: "in-progress",
      direction: "inbound",
      answered_at: "2020-01-01T00:00:00Z",
      duration_seconds: null,
    };
    const res = await POST(
      req({ StatusCallbackEvent: "conference-end", ConferenceSid: "CF1", Duration: "137" }, "CA-caller"),
    );
    expect(res.status).toBe(204);
    expect(h.state.updates.status).toBe("completed");
    expect(h.state.updates.duration_seconds).toBe(137);
    expect(typeof h.state.updates.ended_at).toBe("string");
  });

  test("conference-end without a payload Duration → computes duration from answered_at", async () => {
    h.state.row = {
      id: "c1",
      ended_at: null,
      status: "in-progress",
      direction: "inbound",
      answered_at: "2020-01-01T00:00:00Z",
      duration_seconds: null,
    };
    await POST(req({ StatusCallbackEvent: "conference-end", ConferenceSid: "CF1" }, "CA-caller"));
    expect(h.state.updates.status).toBe("completed");
    expect(typeof h.state.updates.duration_seconds).toBe("number");
    expect(h.state.updates.duration_seconds).toBeGreaterThan(0);
  });

  test("conference-end does NOT clobber a voicemail row (only fills ended_at)", async () => {
    h.state.row = {
      id: "c1",
      ended_at: null,
      status: "voicemail",
      direction: "inbound",
      answered_at: null,
      duration_seconds: 5,
    };
    await POST(req({ StatusCallbackEvent: "conference-end", ConferenceSid: "CF1", Duration: "10" }, "CA-caller"));
    expect(h.state.updates.status).toBeUndefined();
    expect(h.state.updates.duration_seconds).toBeUndefined();
    expect(typeof h.state.updates.ended_at).toBe("string");
  });

  test("conference-end on an outbound row does not set completed here (status webhook owns it)", async () => {
    h.state.row = {
      id: "c1",
      ended_at: null,
      status: "in-progress",
      direction: "outbound",
      answered_at: "2020-01-01T00:00:00Z",
      duration_seconds: null,
    };
    await POST(req({ StatusCallbackEvent: "conference-end", ConferenceSid: "CF1", Duration: "137" }, "CA-agent"));
    expect(h.state.updates.status).toBeUndefined();
    expect(typeof h.state.updates.ended_at).toBe("string");
  });

  test("join/leave events → 204, no update", async () => {
    const res = await POST(req({ StatusCallbackEvent: "participant-join", ConferenceSid: "CF1" }, "CA-agent"));
    expect(res.status).toBe(204);
    expect(h.state.updates).toBeNull();
  });

  test("unknown ref (no row) → 204, no update", async () => {
    h.state.row = null;
    const res = await POST(req({ StatusCallbackEvent: "conference-start", ConferenceSid: "CF1" }, "CA-unknown"));
    expect(res.status).toBe(204);
    expect(h.state.updates).toBeNull();
  });

  test("missing ref → 204, no update", async () => {
    const res = await POST(req({ StatusCallbackEvent: "conference-start", ConferenceSid: "CF1" }));
    expect(res.status).toBe(204);
    expect(h.state.updates).toBeNull();
  });
});
