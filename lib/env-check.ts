/**
 * Soft env validation for app boot + feature-scoped hard asserts.
 * - Importing this module must NEVER throw (so the UI can render).
 * - Use assert* helpers inside APIs/features that truly require env.
 */

import { getCallControlAppId } from "./voice-env"

// Full catalog of envs currently referenced by the app.
export const ALL_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VOICE_SYNC_SECRET_KEY",
  "NEXT_PUBLIC_MAPBOX_TOKEN",
  "NEXT_PUBLIC_BASE_URL",
  "DISPOTOOL_BASE_URL",
  "TELNYX_API_KEY",
  "TELNYX_PUBLIC_KEY",
  "TELNYX_MESSAGING_PROFILE_ID",
  // Required for call control flows:
  "CALL_CONTROL_APP_ID",
  "TELNYX_DEFAULT_CALLER_ID",
  "SHORTIO_API_KEY",
  "SHORTIO_DOMAIN",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GMAIL_FROM",
  "NEXT_PUBLIC_GOOGLE_REDIRECT_URI",
  "NEXT_PUBLIC_SHORTIO_DOMAIN",
  "SENDFOX_API_TOKEN",
  "SENDFOX_API_KEY",
] as const

// Minimal env to let the UI render and Supabase client hydrate.
const CORE_RENDER_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const

// Voice calling (Telnyx) must have these to operate.
const VOICE_ENV = [
  "TELNYX_API_KEY",
  "CALL_CONTROL_APP_ID",
  "TELNYX_DEFAULT_CALLER_ID",
] as const

type Key = (typeof ALL_ENV_VARS)[number]

export function missing(keys: readonly Key[]) {
  return keys.filter((k) => {
    if (k === "CALL_CONTROL_APP_ID") {
      return getCallControlAppId() === ""
    }
    return !process.env[k] || process.env[k] === ""
  })
}

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

export function logStartupWarnings() {
  const coreMissing = missing(CORE_RENDER_ENV)
  if (coreMissing.length) {
    console.warn(
      `[env] Missing core env vars (UI will still render): ${coreMissing.join(", ")}`
    )
  }

  // Soft log of any others we track (helps during setup without killing UI)
  const others = missing(ALL_ENV_VARS as readonly Key[])
  const nonCoreMissing = others.filter((k) => !CORE_RENDER_ENV.includes(k as any))
  if (nonCoreMissing.length) {
    console.warn(
      `[env] Missing optional/feature env vars: ${nonCoreMissing.join(", ")}`
    )
  }

  if (!process.env.SENDFOX_API_TOKEN && !process.env.SENDFOX_API_KEY) {
    console.warn("[env] Optional: SENDFOX_API_TOKEN/SENDFOX_API_KEY not set")
  }
}

// Use inside Telnyx-only endpoints/features
export function assertVoiceEnv() {
  const m = missing(VOICE_ENV)
  const needsCallControl = getCallControlAppId() === ""
  if (m.length || needsCallControl) {
    const missingList = needsCallControl
      ? Array.from(new Set([...m, "CALL_CONTROL_APP_ID"]))
      : m
    throw new Error(
      `Voice calling not configured. Missing: ${missingList.join(", ")}`,
    )
  }
}

// Log once on the server at boot. Never throw here.
if (process.env.NEXT_RUNTIME === "nodejs") {
  try { logStartupWarnings() } catch {}
}
