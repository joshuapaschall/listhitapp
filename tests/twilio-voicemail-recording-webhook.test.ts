import { NextRequest } from "next/server";

const h = vi.hoisted(() => {
  const state = {
    updates: null as any,
    updatedSid: null as any,
    bucket: null as any,
    uploadPath: null as any,
    uploadOpts: null as any,
    // The calls row the org-mismatch guard reads (only when the webhook is
    // signed by a subaccount).
    callRow: null as { org_id: string } | null,
  };
  const client = {
    from: (table: string) => {
      if (table === "calls") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: state.callRow, error: null }) }),
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

// Phase 2A: every Twilio webhook verifies through verifyTwilioWebhook. The
// existing validateMock still decides pass/fail; vw.orgId is the org proven by
// the signing subaccount (null = parent account, no org claim).
const vw = vi.hoisted(() => ({ orgId: null as string | null }))
vi.mock("@/lib/twilio/verify-webhook", () => ({
  verifyTwilioWebhook: async (input: any) =>
    (h.validateMock as any)(input)
      ? vw.orgId
        ? { ok: true, accountSid: "ACsub", account: "subaccount", orgId: vw.orgId }
        : { ok: true, accountSid: "ACparent", account: "parent", orgId: null }
      : { ok: false, reason: "bad_signature" },
}))

vi.mock("@/lib/supabase", () => ({ supabase: h.client, supabaseAdmin: h.client }));

// Recording downloads authenticate as the account that signed the webhook.
const auth = vi.hoisted(() => ({ basicMock: vi.fn() }));
vi.mock("@/lib/twilio/org-client", () => ({ getTwilioBasicAuthForAccount: auth.basicMock }));

const fetchMock = vi.fn();
// @ts-ignore
global.fetch = fetchMock;

const { POST } = await import("../app/api/webhooks/twilio-voicemail-recording/route");

const ACCOUNT = "AC" + "0".repeat(32);
const AUTH = "auth_token_123";

function req(fields: Record<string, string>) {
  return new NextRequest("http://test/api/webhooks/twilio-voicemail-recording", {
    method: "POST",
    body: new URLSearchParams(fields).toString(),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": "sig",
    },
  });
}

const completed = {
  RecordingSid: "RE123",
  RecordingUrl: "https://api.twilio.com/rec/RE123",
  RecordingDuration: "12",
  RecordingStatus: "completed",
  CallSid: "CA-in-1",
};

describe("twilio voicemail recording webhook", () => {
  beforeEach(() => {
    h.validateMock.mockReset().mockReturnValue(true);
    vw.orgId = null;
    h.state.callRow = null;
    auth.basicMock
      .mockReset()
      .mockResolvedValue(`Basic ${Buffer.from(`${ACCOUNT}:${AUTH}`).toString("base64")}`);
    h.state.updates = null;
    h.state.updatedSid = null;
    h.state.bucket = null;
    h.state.uploadPath = null;
    h.state.uploadOpts = null;
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, arrayBuffer: async () => new TextEncoder().encode("mp3").buffer });
    process.env.NEXT_PUBLIC_BASE_URL = "https://app.listhit.io";
  });

  test("bad signature → 403, no update / no upload", async () => {
    h.validateMock.mockReturnValue(false);
    const res = await POST(req(completed));
    expect(res.status).toBe(403);
    expect(h.state.updates).toBeNull();
    expect(h.state.uploadPath).toBeNull();
  });

  test("completed + duration>0 → downloads mp3 (Basic auth), uploads to voicemails, writes recording_url", async () => {
    const res = await POST(req(completed));
    expect(res.status).toBe(204);

    // Download: ${RecordingUrl}.mp3 with Basic base64(accountSid:authToken).
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.twilio.com/rec/RE123.mp3",
      expect.objectContaining({
        headers: { Authorization: `Basic ${Buffer.from(`${ACCOUNT}:${AUTH}`).toString("base64")}` },
      }),
    );

    // The credentials come from the account that signed this webhook.
    expect(auth.basicMock).toHaveBeenCalledWith("ACparent");

    // Uploaded to the voicemails bucket at YYYY/MM/<sid>.mp3.
    expect(h.state.bucket).toBe("voicemails");
    expect(h.state.uploadPath).toMatch(/^\d{4}\/\d{2}\/RE123\.mp3$/);
    expect(h.state.uploadOpts).toEqual({ contentType: "audio/mpeg", upsert: true });

    // Row updated for the call log.
    expect(h.state.updatedSid).toBe("CA-in-1");
    expect(h.state.updates).toEqual(
      expect.objectContaining({
        voicemail: true,
        status: "voicemail",
        recording_url: h.state.uploadPath,
        voicemail_storage_path: h.state.uploadPath,
        voicemail_duration_seconds: 12,
        recording_state: "ready",
      }),
    );
  });

  test("subaccount webhook for its own org's call → downloads with that subaccount's credentials", async () => {
    vw.orgId = "org-A";
    h.state.callRow = { org_id: "org-A" };
    const res = await POST(req(completed));
    expect(res.status).toBe(204);
    expect(auth.basicMock).toHaveBeenCalledWith("ACsub");
    expect(h.state.updates).toEqual(expect.objectContaining({ status: "voicemail", recording_state: "ready" }));
  });

  test("verified subaccount org ≠ the call row's org → 403, no download / no update", async () => {
    vw.orgId = "org-A";
    h.state.callRow = { org_id: "org-B" };
    const res = await POST(req(completed));
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(h.state.updates).toBeNull();
    expect(h.state.uploadPath).toBeNull();
  });

  test("unknown recording account (no credentials) → no download, recording_state failed, 204", async () => {
    auth.basicMock.mockResolvedValue(null);
    const res = await POST(req(completed));
    expect(res.status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(h.state.uploadPath).toBeNull();
    expect(h.state.updates).toEqual({ recording_state: "failed" });
  });

  test("duration 0 → marks missed, no upload", async () => {
    const res = await POST(req({ ...completed, RecordingDuration: "0" }));
    expect(res.status).toBe(204);
    expect(h.state.uploadPath).toBeNull();
    expect(h.state.updates).toEqual(expect.objectContaining({ status: "missed", recording_state: "ready" }));
  });

  test("non-completed status → missed, no upload", async () => {
    const res = await POST(req({ ...completed, RecordingStatus: "failed" }));
    expect(res.status).toBe(204);
    expect(h.state.uploadPath).toBeNull();
    expect(h.state.updates).toEqual(expect.objectContaining({ status: "missed" }));
  });

  test("download failure → recording_state failed, no upload, still 204", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, arrayBuffer: async () => new ArrayBuffer(0) });
    const res = await POST(req(completed));
    expect(res.status).toBe(204);
    expect(h.state.uploadPath).toBeNull();
    expect(h.state.updates).toEqual({ recording_state: "failed" });
  });
});
