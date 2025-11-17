import { NextRequest } from "next/server";
import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";
import { Buffer } from "buffer";

import { TELNYX_API_URL, getTelnyxApiKey } from "@/lib/voice-env";

export { TELNYX_API_URL };

export function telnyxHeaders() {
  const key = getTelnyxApiKey();
  if (!key) {
    throw new Error("Missing TELNYX_API_KEY");
  }
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

// enable sync ed25519 operations
ed.etc.sha512Sync = (...m: Uint8Array[]) => sha512(ed.etc.concatBytes(...m));

export function verifyTelnyxRequest(req: NextRequest, raw: string): boolean {
  if (process.env.SKIP_TELNYX_SIG === "1") return true;
  const sig = req.headers.get("telnyx-signature-ed25519") || "";
  const ts = req.headers.get("telnyx-timestamp") || "";
  if (!sig || !ts) return false;
  const pubKeyBase64 = process.env.TELNYX_PUBLIC_KEY;
  if (!pubKeyBase64) return false;
  const pub = Buffer.from(pubKeyBase64, "base64");
  const msg = Buffer.from(`${ts}|${raw}`);
  const sigBuf = Buffer.from(sig, "base64");
  try {
    return ed.verify(sigBuf, msg, pub);
  } catch {
    return false;
  }
}
