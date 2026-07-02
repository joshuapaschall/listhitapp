import { getTwilioClient } from "@/lib/providers/twilio/client"
import type { SendSmsInput, SendSmsResult, SmsProvider, SmsProviderError } from "./types"

export interface TwilioSmsProviderOptions {
  messagingServiceSid: string
}

// Twilio implementation. The org's Messaging Service is the sender (it selects the
// number), so we pass `messagingServiceSid` — never `from`. A per-message
// `statusCallback` points delivery receipts at the Twilio status webhook. Error
// normalization mirrors the Telnyx provider so downstream `err.status` /
// `err.providerCode` checks keep working across providers.
export class TwilioSmsProvider implements SmsProvider {
  readonly name = "twilio"
  private readonly messagingServiceSid: string

  constructor(opts: TwilioSmsProviderOptions) {
    this.messagingServiceSid = opts.messagingServiceSid
  }

  async sendMessage(input: SendSmsInput): Promise<SendSmsResult> {
    const client = getTwilioClient()
    const base = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")
    const statusCallback = base ? `${base}/api/webhooks/twilio-status` : undefined
    try {
      const msg = await client.messages.create({
        messagingServiceSid: this.messagingServiceSid,
        to: input.to,
        body: input.text,
        ...(input.mediaUrls && input.mediaUrls.length ? { mediaUrl: input.mediaUrls } : {}),
        ...(statusCallback ? { statusCallback } : {}),
      })
      return { id: msg.sid, from: msg.from ?? "" }
    } catch (err) {
      const e = err as { message?: string; status?: number; code?: number | string }
      const error = new Error(e.message || "Twilio API error") as SmsProviderError
      if (typeof e.status === "number") error.status = e.status
      if (e.code != null) error.providerCode = String(e.code)
      throw error
    }
  }
}
