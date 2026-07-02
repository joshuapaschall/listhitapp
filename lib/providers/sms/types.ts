export interface SendSmsInput {
  from?: string | null
  to: string
  text: string
  mediaUrls?: string[]
  messagingProfileId?: string | null
  // Only set when a caller wants an explicit message type. Campaign senders omit
  // it (SMS-or-MMS-by-media, as today); messages/send passes it explicitly.
  type?: "SMS" | "MMS"
  // Only messages/send currently opts into per-profile webhooks. Preserved here
  // so routing through the provider does not alter webhook behavior.
  useProfileWebhooks?: boolean
}

export interface SendSmsResult {
  id: string
  from: string
}

export interface SmsProvider {
  readonly name: string
  // True when the provider does its own queuing/pacing server-side (Twilio
  // Messaging Services). When true, the app-side carrier lookup + Bottleneck
  // rate-limiter wrap MUST be skipped: the lookup is a billable Telnyx API call
  // and the carrier shaping would double-throttle a rail that paces itself.
  readonly managesPacing: boolean
  sendMessage(input: SendSmsInput): Promise<SendSmsResult>
}

export type SmsProviderError = Error & {
  status?: number
  telnyxCode?: string
  providerCode?: string
}
