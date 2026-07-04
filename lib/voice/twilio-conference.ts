import "server-only"

// Conference-based outbound (and later inbound) calling helpers. The agent joins a
// named room; the far party is dialed into the same room. Callbacks are correlated
// back to the call-log row via a ?ref=<agentCallSid> query param.

// Stable, unique room name for a call, derived from the agent leg CallSid.
export function conferenceRoomName(agentCallSid: string): string {
  const safe = agentCallSid.replace(/[^A-Za-z0-9_-]/g, "")
  return `lh_${safe}`
}

// Inbound room name, seeded from the caller's inbound Call SID.
export function inboundConferenceRoomName(callerCallSid: string): string {
  const safe = callerCallSid.replace(/[^A-Za-z0-9_-]/g, "")
  return `lh_in_${safe}`
}

// Build a callback URL carrying the correlation ref (the agent leg CallSid). The
// webhook validates the signature against this FULL URL (query included).
export function refCallbackUrl(base: string, path: string, ref: string): string {
  const b = base.replace(/\/$/, "")
  return `${b}${path}?ref=${encodeURIComponent(ref)}`
}
