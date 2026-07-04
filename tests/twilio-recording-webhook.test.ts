import { NextRequest } from "next/server";

const h = vi.hoisted(() => {
  const state = {
    row: { status: "in-progress" } as { status: string } | null,
    updates: null as any,
    updatedSid: null as any,
    bucket: null as any,
    uploadPath: null as any,
    uploadOpts: null as any,
  };
  const client = {
    from: (table: string) => {
      if (table === "calls") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: state.row, error: null }) }),
          }),
          update: (u: any) => {
            state.updates = u;
            return {
              eq: async (_col: string, val: any) => {
                state.updatedSid = val;
                return { error: null };
              },
            };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
    storage: {
      from: (bucket: string) => {
        state.bucket = bucket;
        return {
          upload: async (path: string, _buf: any, opts: any) => {
            state.uploadPath = path;
            state.uploadOpts = opts;
            return { error: null };
          },
        };
      },
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

const fetchMock = vi.fn();
// @ts-ignore
global.fetch = fetchMock;

const { POST } = await import("../app/api/webhooks/twilio-recording/route");

const ACCOUNT = "AC" + "0".repeat(32);
const AUTH = "auth_token_123";

function req(fields: Record<string, string>, ref?: string) {
  const url = ref
    ? `http://test/api/webhooks/twilio-recording?ref=${encodeURIComponent(ref)}`
    : "http://test/api/webhooks/twilio-recording";
  return new NextRequest(url, {
    method: "POST",
    body: new URLSearchParams(fields).toString(),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": "sig",
    },
  });
}

const completed = {
  RecordingSid: "RE999",
  RecordingUrl: "https://api.twilio.com/rec/RE999",
  RecordingDuration: "42",
  RecordingStatus: "completed",
  CallSid: "CA-parent-1",
};

describe("twilio conversation recording webhook", () => {
  beforeEach(() => {
    h.validateMock.mockReset().mockReturnValue(true);
    h.state.row = { status: "in-progress" };
    h.state.updates = null;
    h.state.updatedSid = null;
    h.state.bucket = null;
    h.state.uploadPath = null;
    h.state.uploadOpts = null;
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, arrayBuffer: async () => new TextEncoder().encode("mp3").buffer });
    process.env.NEXT_PUBLIC_BASE_URL = "https://app.listhit.io";
    process.env.LISTHIT_TWILIO_AUTH_TOKEN = AUTH;
    process.env.LISTHIT_TWILIO_ACCOUNT_SID = ACCOUNT;
  });

  test("bad signature → 403, no upload / no update", async () => {
    h.validateMock.mockReturnValue(false);
    const res = await POST(req(completed));
    expect(res.status).toBe(403);
    expect(h.state.updates).toBeNull();
    expect(h.state.uploadPath).toBeNull();
  });

  test("completed + duration>0 (non-voicemail) → downloads mp3, uploads to call-recordings, writes recording_url without touching status", async () => {
    const res = await POST(req(completed));
    expect(res.status).toBe(204);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.twilio.com/rec/RE999.mp3",
      expect.objectContaining({
        headers: { Authorization: `Basic ${Buffer.from(`${ACCOUNT}:${AUTH}`).toString("base64")}` },
      }),
    );

    expect(h.state.bucket).toBe("call-recordings");
    expect(h.state.uploadPath).toMatch(/^\d{4}\/\d{2}\/RE999\.mp3$/);
    expect(h.state.uploadOpts).toEqual({ contentType: "audio/mpeg", upsert: true });

    expect(h.state.updatedSid).toBe("CA-parent-1");
    expect(h.state.updates).toEqual(
      expect.objectContaining({
        recording_url: h.state.uploadPath,
        recording_state: "ready",
        recording_duration_seconds: 42,
      }),
    );
    // Must NOT change status (a completed call keeps the status webhook's value).
    expect(h.state.updates.status).toBeUndefined();
  });

  test("voicemail row → 204, no upload, no overwrite", async () => {
    h.state.row = { status: "voicemail" };
    const res = await POST(req(completed));
    expect(res.status).toBe(204);
    expect(h.state.uploadPath).toBeNull();
    expect(h.state.updates).toBeNull();
  });

  test("no matching row → 204, no upload", async () => {
    h.state.row = null;
    const res = await POST(req(completed));
    expect(res.status).toBe(204);
    expect(h.state.uploadPath).toBeNull();
    expect(h.state.updates).toBeNull();
  });

  test("duration 0 → recording_state ready, no upload", async () => {
    const res = await POST(req({ ...completed, RecordingDuration: "0" }));
    expect(res.status).toBe(204);
    expect(h.state.uploadPath).toBeNull();
    expect(h.state.updates).toEqual({ recording_state: "ready" });
  });

  test("download failure → recording_state failed, still 204", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, arrayBuffer: async () => new ArrayBuffer(0) });
    const res = await POST(req(completed));
    expect(res.status).toBe(204);
    expect(h.state.uploadPath).toBeNull();
    expect(h.state.updates).toEqual({ recording_state: "failed" });
  });

  // --- C1a: conference recording (no CallSid, correlated via ?ref=) ---
  test("conference recording (ConferenceSid, no CallSid) → resolves by ref, stores + conference_sid", async () => {
    const res = await POST(
      req(
        {
          RecordingSid: "RE-conf",
          RecordingUrl: "https://api.twilio.com/rec/RE-conf",
          RecordingDuration: "60",
          RecordingStatus: "completed",
          ConferenceSid: "CF123",
        },
        "CA-agent",
      ),
    );
    expect(res.status).toBe(204);
    expect(h.state.updatedSid).toBe("CA-agent");
    expect(h.state.bucket).toBe("call-recordings");
    expect(h.state.uploadPath).toMatch(/^\d{4}\/\d{2}\/RE-conf\.mp3$/);
    expect(h.state.updates).toEqual(
      expect.objectContaining({ recording_url: h.state.uploadPath, recording_state: "ready", conference_sid: "CF123" }),
    );
  });

  test("conference voicemail row is still skipped (ref matches a voicemail)", async () => {
    h.state.row = { status: "voicemail" };
    const res = await POST(
      req({ RecordingSid: "RE-conf", RecordingUrl: "u", RecordingDuration: "60", RecordingStatus: "completed" }, "CA-agent"),
    );
    expect(res.status).toBe(204);
    expect(h.state.uploadPath).toBeNull();
    expect(h.state.updates).toBeNull();
  });
});
