import { NextRequest } from "next/server";
import { buildVoiceIdentity } from "@/lib/providers/voice/identity";

// Keep the real twilio.twiml.VoiceResponse (assert real TwiML) but stub validateRequest.
const h = vi.hoisted(() => ({
  validateMock: vi.fn(() => true),
  getOrgTwilioMock: vi.fn(),
  greetingMock: vi.fn(async () => null as string | null),
  routingMock: vi.fn(async () => ({
    routingMode: "browser_only" as string,
    forwardingNumber: null as string | null,
    browserRingTimeoutSeconds: 20,
    voicemailGreetingUrl: null as string | null,
  })),
  createMock: vi.fn(async () => ({ sid: "CA-agent-leg" })),
  state: {
    didOrg: null as string | null,
    members: [] as { id: string }[],
    online: [] as { user_id: string }[],
    inserted: [] as any[],
  },
}));

vi.mock("twilio", async (importOriginal) => {
  const actual: any = await importOriginal();
  const d = actual.default;
  return { ...actual, default: { ...d, validateRequest: h.validateMock } };
});
vi.mock("@/lib/org-twilio/service", () => ({ getOrgTwilio: h.getOrgTwilioMock }));
vi.mock("@/lib/voice/routing", () => ({
  getVoicemailGreetingUrl: h.greetingMock,
  getRoutingConfig: h.routingMock,
}));
vi.mock("@/lib/providers/twilio/client", () => ({
  getTwilioClient: () => ({ calls: { create: h.createMock } }),
}));
vi.mock("@/lib/supabase", () => {
  const client = {
    from: (table: string) => {
      if (table === "inbound_numbers") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: h.state.didOrg ? { org_id: h.state.didOrg } : null,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({ eq: () => Promise.resolve({ data: h.state.members, error: null }) }),
        };
      }
      if (table === "user_presence") {
        return {
          select: () => ({ in: () => ({ eq: () => Promise.resolve({ data: h.state.online, error: null }) }) }),
        };
      }
      if (table === "calls") {
        return {
          insert: async (row: any) => {
            h.state.inserted.push(row);
            return { error: null };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
  return { supabase: client, supabaseAdmin: client };
});

const { POST } = await import("../app/api/webhooks/twilio-voice-incoming/route");

const ORG = "11111111-1111-1111-1111-111111111111";
const U1 = "22222222-2222-2222-2222-222222222222";
const U2 = "33333333-3333-3333-3333-333333333333";
const FWD = "+13335557777";
const ROOM = "lh_in_CA-in-1";

function req(fields: Record<string, string>) {
  return new NextRequest("http://test/api/webhooks/twilio-voice-incoming", {
    method: "POST",
    body: new URLSearchParams(fields).toString(),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": "sig",
    },
  });
}

const inbound = { From: "+12223334444", To: "+18885551234", CallSid: "CA-in-1" };

// Targets passed to calls.create across all agent legs.
function dialedTargets(): string[] {
  return h.createMock.mock.calls.map((c: any[]) => c[0].to);
}

describe("twilio voice incoming webhook (conference model)", () => {
  beforeEach(() => {
    h.validateMock.mockReset().mockReturnValue(true);
    h.getOrgTwilioMock.mockReset().mockResolvedValue({ voice_provider: "twilio", phone_number: "+18885551234" });
    h.state.didOrg = ORG;
    h.state.members = [{ id: U1 }, { id: U2 }];
    h.state.online = [{ user_id: U1 }];
    h.state.inserted = [];
    h.greetingMock.mockReset().mockResolvedValue(null);
    h.createMock.mockReset().mockResolvedValue({ sid: "CA-agent-leg" });
    h.routingMock.mockReset().mockResolvedValue({
      routingMode: "browser_only",
      forwardingNumber: null,
      browserRingTimeoutSeconds: 20,
      voicemailGreetingUrl: null,
    });
    process.env.NEXT_PUBLIC_BASE_URL = "https://app.listhit.io";
    process.env.LISTHIT_TWILIO_AUTH_TOKEN = "AUTH";
    process.env.TELNYX_PINNED_ORG_IDS = "";
  });

  test("bad signature → 403, no insert, no dial-in", async () => {
    h.validateMock.mockReturnValue(false);
    const res = await POST(req(inbound));
    expect(res.status).toBe(403);
    expect(h.state.inserted.length).toBe(0);
    expect(h.createMock).not.toHaveBeenCalled();
  });

  test("no DialCallStatus action branch (conference model uses the agent-leg counter)", async () => {
    // A request carrying DialCallStatus is treated as a NEW inbound call, not an
    // action re-hit — it still rings the conference.
    const res = await POST(req({ ...inbound, DialCallStatus: "no-answer" }));
    const xml = await res.text();
    expect(xml).toContain("<Conference");
    expect(h.createMock).toHaveBeenCalled();
  });

  test("valid + online browser → caller <Conference>; agent dialed into the same room via calls.create", async () => {
    const res = await POST(req(inbound));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/xml");
    const xml = await res.text();

    // Caller waits in the room, recorded from start, ref'd callbacks.
    expect(xml).toContain("<Conference");
    expect(xml).toContain('startConferenceOnEnter="false"');
    expect(xml).toContain(`>${ROOM}</Conference>`);
    expect(xml).toContain('record="record-from-start"');
    expect(xml).toContain("/api/webhooks/twilio-recording?ref=CA-in-1");
    expect(xml).toContain("/api/webhooks/twilio-conference-events?ref=CA-in-1");
    // Caller TwiML no longer carries the agent legs directly.
    expect(xml).not.toContain("<Client>");
    expect(xml).not.toContain("<Number>");

    // Agent dialed in via calls.create with a role=agent ref'd status callback + timeout.
    expect(h.createMock).toHaveBeenCalledTimes(1);
    const arg = h.createMock.mock.calls[0][0];
    expect(arg.to).toBe(`client:${buildVoiceIdentity(ORG, U1)}`);
    expect(arg.from).toBe("+12223334444");
    expect(arg.timeout).toBe(20);
    expect(arg.statusCallback).toBe(
      "https://app.listhit.io/api/webhooks/twilio-voice-status?ref=CA-in-1&role=agent",
    );
    expect(arg.twiml).toContain(ROOM);

    // Row inserted with the agent-leg counter.
    expect(h.state.inserted[0]).toEqual(
      expect.objectContaining({
        call_sid: "CA-in-1",
        direction: "inbound",
        status: "ringing",
        provider: "twilio",
        conference_name: ROOM,
        agent_legs_remaining: 1,
        agent_answered: false,
      }),
    );
    // started_at stamped so the row survives the Calls page "Today" filter.
    expect(typeof h.state.inserted[0].started_at).toBe("string");
    expect(Number.isNaN(Date.parse(h.state.inserted[0].started_at))).toBe(false);
  });

  test("rings every online browser (one agent leg each, counter = 2)", async () => {
    h.state.online = [{ user_id: U1 }, { user_id: U2 }];
    await POST(req(inbound));
    expect(dialedTargets()).toEqual(
      expect.arrayContaining([`client:${buildVoiceIdentity(ORG, U1)}`, `client:${buildVoiceIdentity(ORG, U2)}`]),
    );
    expect(h.createMock).toHaveBeenCalledTimes(2);
    expect(h.state.inserted[0].agent_legs_remaining).toBe(2);
  });

  test("no online browsers → voicemail (<Record>) + insert, no conference, no dial-in", async () => {
    h.state.online = [];
    const res = await POST(req(inbound));
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("<Record");
    expect(xml).toContain("/api/webhooks/twilio-voicemail-recording");
    expect(xml).toContain("<Say>");
    expect(xml).not.toContain("<Conference");
    expect(h.createMock).not.toHaveBeenCalled();
    expect(h.state.inserted.length).toBe(1);
    // Voicemail rows are logged too — started_at stamped so they show in the log.
    expect(typeof h.state.inserted[0].started_at).toBe("string");
    expect(Number.isNaN(Date.parse(h.state.inserted[0].started_at))).toBe(false);
  });

  test("no online browsers + greeting configured → <Play> greeting + <Record>", async () => {
    h.state.online = [];
    h.greetingMock.mockResolvedValue("https://cdn.listhit.io/greetings/org.mp3");
    const res = await POST(req(inbound));
    const xml = await res.text();
    expect(xml).toContain("<Play>https://cdn.listhit.io/greetings/org.mp3</Play>");
    expect(xml).toContain("<Record");
    expect(xml).not.toContain("<Say>");
  });

  test("unknown DID → unavailable + hangup, no insert, no dial-in", async () => {
    h.state.didOrg = null;
    const res = await POST(req(inbound));
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("<Hangup/>");
    expect(xml).not.toContain("<Conference");
    expect(h.state.inserted.length).toBe(0);
    expect(h.createMock).not.toHaveBeenCalled();
  });

  test("org routed to telnyx → refused + hangup, no insert", async () => {
    h.getOrgTwilioMock.mockResolvedValue({ voice_provider: "telnyx", phone_number: "+18885551234" });
    const res = await POST(req(inbound));
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("<Hangup/>");
    expect(xml).not.toContain("<Conference");
    expect(h.state.inserted.length).toBe(0);
  });

  test("invalid To → unavailable + hangup", async () => {
    const res = await POST(req({ ...inbound, To: "not-a-number" }));
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("<Hangup/>");
    expect(xml).not.toContain("<Conference");
  });

  // --- routing modes (V3c parity, conference model) ---
  test("forwarding_only → agent leg dials the forward number only, no client", async () => {
    h.routingMock.mockResolvedValue({
      routingMode: "forwarding_only",
      forwardingNumber: FWD,
      browserRingTimeoutSeconds: 20,
      voicemailGreetingUrl: null,
    });
    const res = await POST(req(inbound));
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("<Conference");
    expect(dialedTargets()).toEqual([FWD]);
    expect(h.state.inserted[0].agent_legs_remaining).toBe(1);
  });

  test("browser_first_then_forward → agent legs for client AND forward (counter = 2)", async () => {
    h.routingMock.mockResolvedValue({
      routingMode: "browser_first_then_forward",
      forwardingNumber: FWD,
      browserRingTimeoutSeconds: 20,
      voicemailGreetingUrl: null,
    });
    await POST(req(inbound));
    expect(dialedTargets()).toEqual(
      expect.arrayContaining([`client:${buildVoiceIdentity(ORG, U1)}`, FWD]),
    );
    expect(h.state.inserted[0].agent_legs_remaining).toBe(2);
  });

  test("forwarding_only with no forward number → downgrades to browser_only (client only)", async () => {
    h.routingMock.mockResolvedValue({
      routingMode: "forwarding_only",
      forwardingNumber: null,
      browserRingTimeoutSeconds: 20,
      voicemailGreetingUrl: null,
    });
    await POST(req(inbound));
    expect(dialedTargets()).toEqual([`client:${buildVoiceIdentity(ORG, U1)}`]);
  });

  test("forward mode with no forward number AND no online → voicemail, no conference", async () => {
    h.state.online = [];
    h.routingMock.mockResolvedValue({
      routingMode: "browser_first_then_forward",
      forwardingNumber: null,
      browserRingTimeoutSeconds: 20,
      voicemailGreetingUrl: null,
    });
    const res = await POST(req(inbound));
    const xml = await res.text();
    expect(xml).toContain("<Record");
    expect(xml).not.toContain("<Conference");
    expect(h.createMock).not.toHaveBeenCalled();
    expect(h.state.inserted.length).toBe(1);
  });

  test("browser_first_then_forward with forward but ZERO online → forward leg only, not voicemail", async () => {
    h.state.online = [];
    h.routingMock.mockResolvedValue({
      routingMode: "browser_first_then_forward",
      forwardingNumber: FWD,
      browserRingTimeoutSeconds: 20,
      voicemailGreetingUrl: null,
    });
    const res = await POST(req(inbound));
    const xml = await res.text();
    expect(xml).toContain("<Conference");
    expect(dialedTargets()).toEqual([FWD]);
    expect(xml).not.toContain("<Record");
  });

  test("uses the configured browserRingTimeoutSeconds as the agent-leg ring timeout", async () => {
    h.routingMock.mockResolvedValue({
      routingMode: "browser_only",
      forwardingNumber: null,
      browserRingTimeoutSeconds: 45,
      voicemailGreetingUrl: null,
    });
    await POST(req(inbound));
    expect(h.createMock.mock.calls[0][0].timeout).toBe(45);
  });
});
