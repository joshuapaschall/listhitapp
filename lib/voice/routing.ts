import { supabaseAdmin } from "@/lib/supabase/admin";

export type CallRoutingMode =
  | "browser_only"
  | "browser_first_then_forward"
  | "forwarding_only";

export interface RoutingConfig {
  routingMode: CallRoutingMode;
  forwardingNumber: string | null;
  browserRingTimeoutSeconds: number;
  voicemailGreetingUrl: string | null;
}

const DEFAULT_ROUTING: RoutingConfig = {
  routingMode: "browser_only",
  forwardingNumber: null,
  browserRingTimeoutSeconds: 20,
  voicemailGreetingUrl: null,
};

function toRoutingMode(value: unknown): CallRoutingMode {
  if (
    value === "browser_only" ||
    value === "browser_first_then_forward" ||
    value === "forwarding_only"
  ) {
    return value;
  }
  return "browser_only";
}

/**
 * Reads the inbound routing configuration for a given DID (E.164).
 * Falls back to safe defaults (browser_only, 20s, no forwarding/greeting)
 * if the row is missing or columns are null — so callers always get a
 * usable config and inbound behavior is unchanged until a number is
 * explicitly configured.
 */
export async function getRoutingConfig(e164: string): Promise<RoutingConfig> {
  if (!e164) return { ...DEFAULT_ROUTING };

  const { data, error } = await supabaseAdmin
    .from("inbound_numbers")
    .select(
      "call_routing_mode, call_forwarding_number, browser_ring_timeout_seconds, voicemail_greeting_url",
    )
    .eq("e164", e164)
    .maybeSingle();

  if (error || !data) {
    return { ...DEFAULT_ROUTING };
  }

  return {
    routingMode: toRoutingMode(data.call_routing_mode),
    forwardingNumber:
      typeof data.call_forwarding_number === "string" && data.call_forwarding_number.trim()
        ? data.call_forwarding_number.trim()
        : null,
    browserRingTimeoutSeconds:
      typeof data.browser_ring_timeout_seconds === "number" &&
      data.browser_ring_timeout_seconds > 0
        ? data.browser_ring_timeout_seconds
        : DEFAULT_ROUTING.browserRingTimeoutSeconds,
    voicemailGreetingUrl:
      typeof data.voicemail_greeting_url === "string" && data.voicemail_greeting_url.trim()
        ? data.voicemail_greeting_url.trim()
        : null,
  };
}

/**
 * Convenience helper: returns just the stored voicemail greeting URL for a DID,
 * or null if none is configured.
 */
export async function getVoicemailGreetingUrl(e164: string): Promise<string | null> {
  const config = await getRoutingConfig(e164);
  return config.voicemailGreetingUrl;
}
