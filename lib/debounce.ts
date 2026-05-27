import { normalizeEmail } from "@/lib/dedup-utils"

export const WRITE_DIAGNOSTIC_TAGS = false

export async function validateEmailDebounce(email: string) {
  const normalized = normalizeEmail(email) || ""
  const apiKey = process.env.DEBOUNCE_API_KEY
  if (!apiKey) {
    console.error("[debounce] Missing DEBOUNCE_API_KEY")
    return { ok: false, result: "Unknown(api_error)", reason: "missing_key", sendTransactional: false, role: false, freeEmail: false, didYouMean: "", raw: null }
  }

  try {
    const res = await fetch(`https://api.debounce.io/v1/?email=${encodeURIComponent(normalized)}&api=${encodeURIComponent(apiKey)}`)
    const raw = await res.json()
    const data = raw?.debounce || {}
    return {
      ok: res.ok && raw?.success === "1",
      result: String(data.result || "Unknown"),
      reason: String(data.reason || ""),
      sendTransactional: String(data.send_transactional || "0") === "1",
      role: String(data.role || "false") === "true",
      freeEmail: String(data.free_email || "false") === "true",
      didYouMean: String(data.did_you_mean || ""),
      raw,
    }
  } catch (error) {
    console.error("[debounce] Validation error", error)
    return { ok: false, result: "Unknown(api_error)", reason: "api_error", sendTransactional: false, role: false, freeEmail: false, didYouMean: "", raw: null }
  }
}

export function isEmailAcceptable(v: { result: string }) {
  if (v.result === "Invalid") return { accept: false, code: "invalid_email" }
  if (v.result === "Risky") return { accept: true, code: "ok", tag: "email-risky" }
  if (v.result === "Unknown(api_error)") return { accept: true, code: "ok", tag: "email-unverified" }
  return { accept: true, code: "ok" }
}
