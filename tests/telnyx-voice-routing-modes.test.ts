import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useMswServer } from "./helpers/msw"

// All mocks live inside vi.hoisted() so they exist before vi.mock factories
// (which Vitest hoists to the top of the module) reference them. Declaring them
// as plain top-level consts triggers a TDZ ReferenceError.
const h = vi.hoisted(() => {
  // Captured Telnyx Call-Control requests: { url, body }.
  const calls: Array<{ url: string; body: any }> = [];

  // The repo's tests/setup.ts starts a global MSW server that wraps fetch and
  // calls response.clone(). Returning a real Response (fresh per call, so the
  // body isn't double-consumed) satisfies both MSW and cc()'s r.json().
  const fetchMock = vi.fn(async (input: any) => {
    const url = typeof input === "string" ? input : input.url;
    let body: any = null;
    try {
      const text = typeof input === "string" ? null : await input.clone().text();
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    calls.push({ url, body });
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });

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

  return {
    calls, fetchMock, getRoutingConfigMock, startVoicemailMock, getWebRTCSipUriMock,
    updateEqMock, updateMock, upsertMock, maybeSingleMock, supabaseAdminMock,
  };
});

vi.stubGlobal("fetch", h.fetchMock);
vi.mock("@/lib/voice/routing", () => ({ getRoutingConfig: h.getRoutingConfigMock }));
vi.mock("@/lib/voice/voicemail", () => ({ startVoicemail: h.startVoicemailMock }));
vi.mock("@/lib/voice/webrtc-sip", () => ({ getWebRTCSipUri: h.getWebRTCSipUriMock }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: h.supabaseAdminMock }));

import { POST } from "../app/api/webhooks/telnyx-voice/route";

const transferBodies = () => h.calls.filter((c) => c.url.includes("/actions/transfer")).map((c) => c.body);
const updatePayloads = () => h.updateMock.mock.calls.map((c) => c[0]);

function inboundReq(callId: string) {
  return new NextRequest("http://localhost", {
    method: "POST",
    body: JSON.stringify({
      data: {
        event_type: "call.initiated",
        payload: {
          call_control_id: callId,
          call_session_id: `sess-${callId}`,
          direction: "incoming",
          from: "+15551112222",
          to: "+15556667777",
        },
      },
    }),
  });
}

useMswServer();

describe("telnyx voice routing modes", () => {
  beforeEach(() => {
    h.calls.length = 0;
    h.fetchMock.mockClear();
    h.getRoutingConfigMock.mockReset();
    h.startVoicemailMock.mockReset();
    h.getWebRTCSipUriMock.mockReset();
    h.updateMock.mockClear();
    h.updateEqMock.mockClear();
    h.upsertMock.mockClear();
    h.maybeSingleMock.mockClear();
    process.env.TELNYX_API_KEY = "test-key";
    // The route verifies the Telnyx Ed25519 signature before processing; bypass
    // it in tests (these requests carry no signature header).
    process.env.SKIP_TELNYX_SIG = "1";
  });

  test("forwarding_only transfers to forwarding number using DID as from", async () => {
    h.getRoutingConfigMock.mockResolvedValue({
      routingMode: "forwarding_only",
      forwardingNumber: "+15550009999",
      browserRingTimeoutSeconds: 12,
      voicemailGreetingUrl: null,
    });

    await POST(inboundReq("call-1"));

    const body = transferBodies()[0];
    expect(body.to).toBe("+15550009999");
    expect(body.from).toBe("+15556667777"); // our DID, not the original caller
    expect(updatePayloads()).toContainEqual(
      expect.objectContaining({ routing_mode: "forwarding_only", forwarded_to: "+15550009999" }),
    );
    expect(h.startVoicemailMock).not.toHaveBeenCalled();
  });

  test("browser_only transfers to sip uri using original caller as from", async () => {
    h.getRoutingConfigMock.mockResolvedValue({
      routingMode: "browser_only",
      forwardingNumber: null,
      browserRingTimeoutSeconds: 10,
      voicemailGreetingUrl: null,
    });
    h.getWebRTCSipUriMock.mockResolvedValue("sip:agent@sip.telnyx.com");

    await POST(inboundReq("call-2"));

    const body = transferBodies()[0];
    expect(body.to).toBe("sip:agent@sip.telnyx.com");
    expect(body.from).toBe("+15551112222"); // original caller, for browser caller-ID
  });

  test("browser_first_then_forward with no SIP URI transfers to forwarding number", async () => {
    h.getRoutingConfigMock.mockResolvedValue({
      routingMode: "browser_first_then_forward",
      forwardingNumber: "+15550008888",
      browserRingTimeoutSeconds: 10,
      voicemailGreetingUrl: null,
    });
    h.getWebRTCSipUriMock.mockResolvedValue(null);

    await POST(inboundReq("call-3"));

    const body = transferBodies()[0];
    expect(body.to).toBe("+15550008888");
    expect(body.from).toBe("+15556667777");
  });

  test("mode requiring forward with no forwarding number falls back to browser", async () => {
    h.getRoutingConfigMock.mockResolvedValue({
      routingMode: "forwarding_only",
      forwardingNumber: null,
      browserRingTimeoutSeconds: 10,
      voicemailGreetingUrl: null,
    });
    h.getWebRTCSipUriMock.mockResolvedValue("sip:backup@sip.telnyx.com");

    await POST(inboundReq("call-4"));

    const body = transferBodies()[0];
    expect(body.to).toBe("sip:backup@sip.telnyx.com");
    expect(h.startVoicemailMock).not.toHaveBeenCalled();
  });
});
