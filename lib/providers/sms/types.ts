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
  sendMessage(input: SendSmsInput): Promise<SendSmsResult>
}

export type SmsProviderError = Error & {
  status?: number
  telnyxCode?: string
  providerCode?: string
}
