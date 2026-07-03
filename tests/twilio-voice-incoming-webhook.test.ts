import { NextRequest } from "next/server";
import { buildVoiceIdentity } from "@/lib/providers/voice/identity";

// Keep the real twilio.twiml.VoiceResponse (assert real TwiML) but stub validateRequest.
const h = vi.hoisted(() => ({
  validateMock: vi.fn(() => true),
  getOrgTwilioMock: vi.fn(),
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

describe("twilio voice incoming webhook", () => {
  beforeEach(() => {
    h.validateMock.mockReset().mockReturnValue(true);
    h.getOrgTwilioMock.mockReset().mockResolvedValue({ voice_provider: "twilio", phone_number: "+18885551234" });
    h.state.didOrg = ORG;
    h.state.members = [{ id: U1 }, { id: U2 }];
    h.state.online = [{ user_id: U1 }];
    h.state.inserted = [];
    process.env.NEXT_PUBLIC_BASE_URL = "https://app.listhit.io";
    process.env.LISTHIT_TWILIO_AUTH_TOKEN = "AUTH";
    process.env.TELNYX_PINNED_ORG_IDS = "";
  });

  test("bad signature → 403, no insert", async () => {
    h.validateMock.mockReturnValue(false);
    const res = await POST(req(inbound));
    expect(res.status).toBe(403);
    expect(h.state.inserted.length).toBe(0);
  });

  test("valid + online browser → <Dial><Client> ringing the online identity, inbound calls insert", async () => {
    const res = await POST(req(inbound));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/xml");
    const xml = await res.text();
    expect(xml).toContain('<Dial');
    expect(xml).toContain('callerId="+12223334444"');
    expect(xml).toContain(`<Client>${buildVoiceIdentity(ORG, U1)}</Client>`);
    // U2 is offline → not rung.
    expect(xml).not.toContain(buildVoiceIdentity(ORG, U2));

    expect(h.state.inserted.length).toBe(1);
    expect(h.state.inserted[0]).toEqual(
      expect.objectContaining({
        call_sid: "CA-in-1",
        org_id: ORG,
        direction: "inbound",
        from_number: "+12223334444",
        to_number: "+18885551234",
        status: "ringing",
        provider: "twilio",
      }),
    );
  });

  test("rings every online browser (one <Client> each)", async () => {
    h.state.online = [{ user_id: U1 }, { user_id: U2 }];
    const res = await POST(req(inbound));
    const xml = await res.text();
    expect(xml).toContain(`<Client>${buildVoiceIdentity(ORG, U1)}</Client>`);
    expect(xml).toContain(`<Client>${buildVoiceIdentity(ORG, U2)}</Client>`);
  });

  test("no online browsers → <Say> + <Hangup/>, no <Client>, no insert", async () => {
    h.state.online = [];
    const res = await POST(req(inbound));
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("<Say>");
    expect(xml).toContain("<Hangup/>");
    expect(xml).not.toContain("<Client>");
    expect(h.state.inserted.length).toBe(0);
  });

  test("unknown DID → unavailable + hangup, no insert", async () => {
    h.state.didOrg = null;
    const res = await POST(req(inbound));
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("<Hangup/>");
    expect(xml).not.toContain("<Dial");
    expect(h.state.inserted.length).toBe(0);
  });

  test("org routed to telnyx → refused + hangup, no insert", async () => {
    h.getOrgTwilioMock.mockResolvedValue({ voice_provider: "telnyx", phone_number: "+18885551234" });
    const res = await POST(req(inbound));
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("<Hangup/>");
    expect(xml).not.toContain("<Dial");
    expect(h.state.inserted.length).toBe(0);
  });

  test("invalid To → unavailable + hangup", async () => {
    const res = await POST(req({ ...inbound, To: "not-a-number" }));
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("<Hangup/>");
    expect(xml).not.toContain("<Dial");
  });
});
