import "server-only"

import twilio from "twilio"

// Voicemail TwiML tail + storage-path helper shared by the inbound + recording
// webhooks. No Telnyx imports — this is the Twilio voicemail path only.

export interface AppendVoicemailOptions {
  greetingUrl: string | null
  recordingStatusCallback: string
  fallbackText?: string
}

// Appends the greeting (<Play> a per-DID URL, else <Say> a fallback) + <Record>
// (beep, trim silence, status-callback) + <Hangup/> to an existing VoiceResponse.
export function appendVoicemailTwiml(
  vr: InstanceType<typeof twilio.twiml.VoiceResponse>,
  opts: AppendVoicemailOptions,
): void {
  if (opts.greetingUrl) {
    vr.play({}, opts.greetingUrl)
  } else {
    vr.say(opts.fallbackText ?? "Please leave a message after the tone. When finished, hang up.")
  }
  vr.record({
    maxLength: 120,
    playBeep: true,
    timeout: 5,
    trim: "trim-silence",
    recordingStatusCallback: opts.recordingStatusCallback,
    recordingStatusCallbackMethod: "POST",
  })
  vr.hangup()
}

// Storage path scheme MUST match the Telnyx voicemail handler: YYYY/MM/<safeId>.mp3.
export function voicemailStoragePath(recordingSid: string, when = new Date()): string {
  const yyyy = when.getUTCFullYear()
  const mm = String(when.getUTCMonth() + 1).padStart(2, "0")
  const safe = recordingSid.replace(/[^A-Za-z0-9_-]/g, "")
  return `${yyyy}/${mm}/${safe}.mp3`
}
