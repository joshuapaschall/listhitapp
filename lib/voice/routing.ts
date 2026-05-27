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

  type RoutingSourceRow = {
    call_routing_mode: unknown;
    call_forwarding_number: unknown;
    browser_ring_timeout_seconds: unknown;
    voicemail_greeting_url: unknown;
  };

  type InboundNumberWithMarket = RoutingSourceRow & {
    config_override: boolean | null;
    market_id: string | null;
    market: RoutingSourceRow | RoutingSourceRow[] | null;
  };

  const { data: num, error } = await supabaseAdmin
    .from("inbound_numbers")
    .select(
      `
        call_routing_mode, call_forwarding_number, browser_ring_timeout_seconds,
        voicemail_greeting_url, config_override, market_id,
        market:markets!inbound_numbers_market_id_fkey(
          call_routing_mode, call_forwarding_number, browser_ring_timeout_seconds,
          voicemail_greeting_url
        )
      `,
    )
    .eq("e164", e164)
    .maybeSingle();

  if (error || !num) {
    return { ...DEFAULT_ROUTING };
  }

  const typedNum = num as unknown as InboundNumberWithMarket;
  const marketSource = Array.isArray(typedNum.market) ? typedNum.market[0] : typedNum.market;
  const source: RoutingSourceRow = typedNum.config_override ? typedNum : (marketSource ?? typedNum);

  return {
    routingMode: toRoutingMode(source.call_routing_mode),
    forwardingNumber:
      typeof source.call_forwarding_number === "string" && source.call_forwarding_number.trim()
        ? source.call_forwarding_number.trim()
        : null,
    browserRingTimeoutSeconds:
      typeof source.browser_ring_timeout_seconds === "number" &&
      source.browser_ring_timeout_seconds > 0
        ? source.browser_ring_timeout_seconds
        : DEFAULT_ROUTING.browserRingTimeoutSeconds,
    voicemailGreetingUrl:
      typeof source.voicemail_greeting_url === "string" && source.voicemail_greeting_url.trim()
        ? source.voicemail_greeting_url.trim()
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
