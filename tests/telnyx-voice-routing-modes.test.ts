import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const getRoutingConfigMock = vi.fn();
const startVoicemailMock = vi.fn();
const getWebRTCSipUriMock = vi.fn();

const updateEqMock = vi.fn(async () => ({ error: null }));
const updateMock = vi.fn(() => ({ eq: updateEqMock }));
const upsertMock = vi.fn(async () => ({ error: null }));
const maybeSingleMock = vi.fn(async () => ({ data: null, error: null }));

const supabaseAdminMock = {
  from: vi.fn((table: string) => {
    if (table === "buyers") {
      return { select: () => ({ or: () => ({ limit: () => ({ maybeSingle: maybeSingleMock }) }) }) };
    }
    if (table === "calls") {
      return {
        upsert: upsertMock,
        update: updateMock,
        select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
      };
    }
    throw new Error(`Unexpected table ${table}`);
  }),
};

vi.mock("@/lib/voice/routing", () => ({ getRoutingConfig: getRoutingConfigMock }));
vi.mock("@/lib/voice/voicemail", () => ({ startVoicemail: startVoicemailMock }));
vi.mock("@/lib/voice/webrtc-sip", () => ({ getWebRTCSipUri: getWebRTCSipUriMock }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: supabaseAdminMock }));

import { POST } from "../app/api/webhooks/telnyx-voice/route";

const transferCall = (idx: number) => JSON.parse(fetchMock.mock.calls[idx][1].body as string);

describe("telnyx voice routing modes", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    getRoutingConfigMock.mockReset();
    startVoicemailMock.mockReset();
    getWebRTCSipUriMock.mockReset();
    supabaseAdminMock.from.mockClear();
    upsertMock.mockClear();
    updateMock.mockClear();
    updateEqMock.mockClear();
    maybeSingleMock.mockClear();

    process.env.TELNYX_API_KEY = "test-key";
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
  });

  test("forwarding_only transfers to forwarding number using DID as from", async () => {
    getRoutingConfigMock.mockResolvedValue({
      routingMode: "forwarding_only",
      forwardingNumber: "+15550009999",
      browserRingTimeoutSeconds: 12,
      voicemailGreetingUrl: null,
    });

    const req = new NextRequest("http://localhost", { method: "POST", body: JSON.stringify({ data: { event_type: "call.initiated", payload: { call_control_id: "call-1", call_session_id: "sess-1", direction: "incoming", from: "+15551112222", to: "+15556667777" } } }) });
    await POST(req);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = transferCall(1);
    expect(body.to).toBe("+15550009999");
    expect(body.from).toBe("+15556667777");
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ routing_mode: "forwarding_only", forwarded_to: "+15550009999" }));
  });

  test("browser_only transfers to sip uri using original caller as from", async () => {
    getRoutingConfigMock.mockResolvedValue({ routingMode: "browser_only", forwardingNumber: null, browserRingTimeoutSeconds: 10, voicemailGreetingUrl: null });
    getWebRTCSipUriMock.mockResolvedValue("sip:agent@sip.telnyx.com");

    const req = new NextRequest("http://localhost", { method: "POST", body: JSON.stringify({ data: { event_type: "call.initiated", payload: { call_control_id: "call-2", call_session_id: "sess-2", direction: "incoming", from: "+15551112222", to: "+15556667777" } } }) });
    await POST(req);

    const body = transferCall(1);
    expect(body.to).toBe("sip:agent@sip.telnyx.com");
    expect(body.from).toBe("+15551112222");
  });

  test("browser_first_then_forward with no SIP URI transfers to forwarding number", async () => {
    getRoutingConfigMock.mockResolvedValue({ routingMode: "browser_first_then_forward", forwardingNumber: "+15550008888", browserRingTimeoutSeconds: 10, voicemailGreetingUrl: null });
    getWebRTCSipUriMock.mockResolvedValue(null);

    const req = new NextRequest("http://localhost", { method: "POST", body: JSON.stringify({ data: { event_type: "call.initiated", payload: { call_control_id: "call-3", call_session_id: "sess-3", direction: "incoming", from: "+15551112222", to: "+15556667777" } } }) });
    await POST(req);

    const body = transferCall(1);
    expect(body.to).toBe("+15550008888");
    expect(body.from).toBe("+15556667777");
  });

  test("mode requiring forward with no forwarding number falls back to browser", async () => {
    getRoutingConfigMock.mockResolvedValue({ routingMode: "forwarding_only", forwardingNumber: null, browserRingTimeoutSeconds: 10, voicemailGreetingUrl: null });
    getWebRTCSipUriMock.mockResolvedValue("sip:backup@sip.telnyx.com");

    const req = new NextRequest("http://localhost", { method: "POST", body: JSON.stringify({ data: { event_type: "call.initiated", payload: { call_control_id: "call-4", call_session_id: "sess-4", direction: "incoming", from: "+15551112222", to: "+15556667777" } } }) });
    await POST(req);

    const body = transferCall(1);
    expect(body.to).toBe("sip:backup@sip.telnyx.com");
    expect(startVoicemailMock).not.toHaveBeenCalled();
  });
});
