import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx"

export async function lookupNumber(e164: string) {
  try {
    const res = await fetch(`${TELNYX_API_URL}/number_lookup/${encodeURIComponent(e164)}?type=carrier`, {
      headers: telnyxHeaders(),
    })
    const raw = await res.json()
    const carrier = raw?.data?.carrier || {}
    return {
      ok: res.ok,
      lineType: String(carrier.type || "unknown"),
      carrierName: String(carrier.name || ""),
      raw,
    }
  } catch (error) {
    console.error("[number-lookup] error", error)
    return { ok: false, lineType: "unknown(api_error)", carrierName: "", raw: null }
  }
}

export function isLineAcceptable(lookup: { lineType: string }) {
  const lineType = lookup.lineType
  if (lineType === "unknown(api_error)") return { accept: true, code: "ok", lineType }
  if (lineType === "mobile" || lineType === "fixed line or mobile") return { accept: true, code: "ok", lineType }
  if (lineType === "voip") {
    const allowVoip = process.env.ALLOW_VOIP_SIGNUPS === "true"
    return allowVoip ? { accept: true, code: "ok", lineType } : { accept: false, code: "voip_not_allowed", lineType }
  }
  if (lineType === "fixed line") return { accept: false, code: "landline_not_allowed", lineType }
  return { accept: false, code: "invalid_line_type", lineType }
}
