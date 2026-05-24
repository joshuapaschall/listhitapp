import { supabaseAdmin } from "@/lib/supabase";

let cachedSipUri: string | null = null;

export async function getWebRTCSipUri(): Promise<string | null> {
  if (cachedSipUri) {
    return cachedSipUri;
  }

  try {
    const envUsername = process.env.TELNYX_WEBRTC_SIP_USERNAME?.trim();
    if (envUsername) {
      const sipUri = `sip:${envUsername}@sip.telnyx.com`;
      cachedSipUri = sipUri;
      return sipUri;
    }

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
    if (sipUsername) {
      const sipUri = `sip:${sipUsername}@sip.telnyx.com`;
      cachedSipUri = sipUri;
      return sipUri;
    }

    return null;
  } catch (error) {
    console.error("[webrtc-sip] failed to resolve WebRTC SIP URI", error);
    return null;
  }
}
