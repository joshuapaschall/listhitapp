import { NextRequest } from "next/server";
import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx";
import { getTelnyxApiKey } from "@/lib/voice-env";

export async function POST(request: NextRequest) {
  if (!getTelnyxApiKey()) {
    return new Response(JSON.stringify({ error: "Telnyx not configured" }), { status: 500 });
  }
  const { callControlId } = await request.json();
  if (!callControlId) {
    return new Response(JSON.stringify({ error: "callControlId required" }), { status: 400 });
  }
  try {
    const url = `${TELNYX_API_URL}/calls/${callControlId}/actions/reject`;
    const payload = {
      client_state: "incoming_declined",
      command_id: crypto.randomUUID(),
      cause: "USER_BUSY"
    };
    const res = await fetch(url, {
      method: "POST",
      headers: telnyxHeaders(),
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("Telnyx reject error", text);
      return new Response(text, { status: res.status });
    }
    return new Response(text, { status: 200 });
  } catch (err: any) {
    console.error("Reject call error", err);
    return new Response(JSON.stringify({ error: err.message || "error" }), { status: 500 });
  }
}
