import { TELNYX_API_URL, getTelnyxApiKey } from "@/lib/voice-env"
import type { SendSmsInput, SendSmsResult, SmsProvider, SmsProviderError } from "./types"

// Telnyx implementation. This is the exact fetch + response parsing + error
// normalization that previously lived inline in the SMS senders, consolidated
// here. The thrown error carries `.status`, `.telnyxCode`, and `.providerCode`
// so the campaign queue's `err.telnyxCode === "40300"` check keeps working.
export class TelnyxSmsProvider implements SmsProvider {
  readonly name = "telnyx"
  // Telnyx has no server-side pacing — the app owns carrier lookup + Bottleneck.
  readonly managesPacing = false

  async sendMessage(input: SendSmsInput): Promise<SendSmsResult> {
    const url = `${TELNYX_API_URL}/messages`

    const payload: Record<string, any> = {
      to: input.to,
      text: input.text,
      messaging_profile_id: input.messagingProfileId ?? process.env.TELNYX_MESSAGING_PROFILE_ID,
    }
    if (input.from) {
      payload.from = input.from
    }
    if (input.mediaUrls && input.mediaUrls.length) {
      payload.media_urls = input.mediaUrls
    }
    if (input.type) {
      payload.type = input.type
    }
    if (input.useProfileWebhooks) {
      payload.use_profile_webhooks = true
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getTelnyxApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error("Telnyx error", text)
      let msg = `Telnyx API error: ${response.status}`
      let telnyxCode: string | undefined
      try {
        const err = JSON.parse(text)
        const code = err.errors?.[0]?.code
        if (code !== undefined && code !== null) telnyxCode = String(code)
        if (err.errors && err.errors[0]?.detail) msg = err.errors[0].detail
      } catch (err) {
        console.error("telnyx-provider: failed to parse Telnyx error response:", err)
      }
      const error = new Error(msg) as SmsProviderError
      error.status = response.status
      if (telnyxCode) {
        error.telnyxCode = telnyxCode
        error.providerCode = telnyxCode
      }
      throw error
    }

    const json = await response.json()
    const data = json.data as { id: string; from: any }
    const from = typeof data.from === "string" ? data.from : data.from?.phone_number || ""
    return { id: data.id, from }
  }
}
