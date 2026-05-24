import { supabaseAdmin } from "@/lib/supabase";

/**
 * Resolve the SIP URI to transfer inbound PSTN calls to.
 *
 * The browser registers under the per-user telephony-credential username stored
 * in profiles.sip_username (e.g. "sip_4821_a3f2"), minted by
 * /api/telnyx/webrtc-token. Inbound calls MUST be transferred to that EXACT
 * username, otherwise Telnyx routes them to a different/stale identity and the
 * callee returns SIP 480. Do NOT introduce a static or env-based username here —
 * that was the previous bug (TELNYX_WEBRTC_SIP_USERNAME pointed at the
 * connection-level username "listhitapp", not the registered telephony cred).
 */
export async function getWebRTCSipUri(): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("sip_username")
      .not("sip_username", "is", null)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const sipUsername = data?.sip_username?.trim();
    if (!sipUsername) {
      console.warn("[webrtc-sip] no profiles.sip_username found — cannot route inbound");
      return null;
    }

    const sipUri = `sip:${sipUsername}@sip.telnyx.com`;
    console.log("[webrtc-sip] resolved inbound transfer target", { sipUri });
    return sipUri;
  } catch (error) {
    console.error("[webrtc-sip] failed to resolve WebRTC SIP URI", error);
    return null;
  }
}
