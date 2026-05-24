/**
 * Resolve the SIP URI to transfer inbound PSTN calls to.
 *
 * The browser registers with the CREDENTIAL CONNECTION's connection-level
 * username/password (see /api/telnyx/webrtc-credentials + CallProvider). Telnyx
 * supports inbound SIP URI calling to credential-connection usernames (gated by
 * the connection's sip_uri_calling_preference) — NOT to per-user telephony
 * credentials, transferring to which returns 10010/D11 "Destination Number is
 * invalid". So we transfer to the connection username from
 * TELNYX_WEBRTC_SIP_USERNAME, which is exactly what the browser registers as.
 */
export async function getWebRTCSipUri(): Promise<string | null> {
  try {
    const username = (process.env.TELNYX_WEBRTC_SIP_USERNAME ?? "").trim();
    if (!username) {
      console.warn("[webrtc-sip] TELNYX_WEBRTC_SIP_USERNAME not set — cannot route inbound");
      return null;
    }
    const sipUri = `sip:${username}@sip.telnyx.com`;
    console.log("[webrtc-sip] resolved inbound transfer target", { sipUri });
    return sipUri;
  } catch (error) {
    console.error("[webrtc-sip] failed to resolve WebRTC SIP URI", error);
    return null;
  }
}
