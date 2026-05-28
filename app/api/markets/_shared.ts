export const ALLOWED_MODES = ["browser_only", "browser_first_then_forward", "forwarding_only"] as const;
export const ALLOWED_SOURCES = ["polly", "recorded"] as const;

export type RoutingMode = (typeof ALLOWED_MODES)[number];
export type GreetingSource = (typeof ALLOWED_SOURCES)[number];

export { requireOrgContext } from "@/lib/auth/org-context";

export function validatePatchBody(body: Record<string, unknown>) {
  const update: Record<string, unknown> = {};
  if (body.name !== undefined && typeof body.name === "string") {
    update.name = body.name.trim();
  }
  if (body.call_routing_mode !== undefined) {
    if (typeof body.call_routing_mode !== "string" || !ALLOWED_MODES.includes(body.call_routing_mode as RoutingMode)) {
      return { error: "Invalid call_routing_mode" };
    }
    update.call_routing_mode = body.call_routing_mode;
  }
  if (body.browser_ring_timeout_seconds !== undefined) {
    const parsed = Number.parseInt(String(body.browser_ring_timeout_seconds), 10);
    if (!Number.isFinite(parsed) || parsed < 5 || parsed > 60) return { error: "Invalid browser_ring_timeout_seconds" };
    update.browser_ring_timeout_seconds = parsed;
  }
  if (body.call_forwarding_number !== undefined) {
    if (body.call_forwarding_number === null) update.call_forwarding_number = null;
    else if (typeof body.call_forwarding_number === "string") {
      const trimmed = body.call_forwarding_number.trim();
      if (!trimmed) update.call_forwarding_number = null;
      else if (!/^\+[0-9]+$/.test(trimmed)) return { error: "Invalid call_forwarding_number" };
      else update.call_forwarding_number = trimmed;
    } else return { error: "Invalid call_forwarding_number" };
  }
  if (body.voicemail_greeting_url !== undefined) {
    if (body.voicemail_greeting_url === null) update.voicemail_greeting_url = null;
    else if (typeof body.voicemail_greeting_url === "string") update.voicemail_greeting_url = body.voicemail_greeting_url.trim() || null;
    else return { error: "Invalid voicemail_greeting_url" };
  }
  if (body.voicemail_greeting_source !== undefined) {
    if (body.voicemail_greeting_source === null) update.voicemail_greeting_source = null;
    else if (typeof body.voicemail_greeting_source === "string" && ALLOWED_SOURCES.includes(body.voicemail_greeting_source as GreetingSource)) {
      update.voicemail_greeting_source = body.voicemail_greeting_source;
    } else return { error: "Invalid voicemail_greeting_source" };
  }
  return { update };
}
