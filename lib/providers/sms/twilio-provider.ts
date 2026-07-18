import { getTwilioClient } from "@/lib/providers/twilio/client"
import type { SendSmsInput, SendSmsResult, SmsProvider, SmsProviderError } from "./types"

export interface TwilioSmsProviderOptions {
  messagingServiceSid: string
}

// Twilio implementation. When the caller resolves an explicit `from` (campaign
// market-pool rotation), send from that number so rotation stays correct; only
// fall back to the org's Messaging Service (`messagingServiceSid`, which selects
// its own number) when no `from` is provided. A per-message `statusCallback`
// points delivery receipts at the Twilio status webhook. Error normalization
// mirrors the Telnyx provider so downstream `err.status` / `err.providerCode`
// checks keep working across providers.
export class TwilioSmsProvider implements SmsProvider {
  readonly name = "twilio"
  // The Messaging Service queues and paces sends server-side at the campaign's
  // approved throughput, so the app-side carrier lookup + Bottleneck are skipped.
  readonly managesPacing = true
  private readonly messagingServiceSid: string

  constructor(opts: TwilioSmsProviderOptions) {
    this.messagingServiceSid = opts.messagingServiceSid
  }

  async sendMessage(input: SendSmsInput): Promise<SendSmsResult> {
    const client = getTwilioClient()
    const base = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")
    const statusCallback = base ? `${base}/api/webhooks/twilio-status` : undefined
    const from = input.from ? String(input.from).trim() : ""
    // Explicit rotated number wins; otherwise let the Messaging Service pick.
    const senderParams = from
      ? { from }
      : { messagingServiceSid: this.messagingServiceSid }
    try {
      const msg = await client.messages.create({
        ...senderParams,
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
