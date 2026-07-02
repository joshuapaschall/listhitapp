import { supabaseAdmin } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { scheduleSMS, lookupCarrier } from "@/lib/sms-rate-limiter"
import { normalizePhone, formatPhoneE164 } from "@/lib/dedup-utils"
import { getTelnyxApiKey } from "@/lib/voice-env"
import { resolveOutboundFrom, recordStickyFrom } from "@/lib/sender/sticky-sender"
import { ensurePublicMediaUrls } from "@/utils/mms.server"
import { resolveSmsProvider } from "@/lib/providers/sms"
export { sendEmailCampaign } from "./campaign-sender"

const log = createLogger("campaign-sender")

const telnyxApiKey = getTelnyxApiKey()
const messagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID

interface SmsSendResult {
  to: string
  sid: string
  from: string
}

interface SmsOptions {
  buyerId?: string
  to: string[]
  body: string
  campaignId?: string
  mediaUrls?: string[]
  dryRun?: boolean
  isTest?: boolean
  // Org context for provider routing. Omit when there is genuinely no org in
  // scope — resolveSmsProvider(undefined) falls back to Telnyx (safe default).
  orgId?: string
}

export async function sendCampaignSMS({ buyerId, to, body, mediaUrls, dryRun, campaignId, isTest, orgId }: SmsOptions): Promise<SmsSendResult[]> {
  if (!telnyxApiKey || !messagingProfileId) {
    throw new Error("Telnyx environment variables are not properly configured")
  }

  if (dryRun) {
    for (const num of to) {
      const formatted = formatPhoneE164(num) || num
      log("sms", "[DRY RUN]", { to: formatted, body })
    }
    return to.map((num) => ({ to: formatPhoneE164(num) || num, sid: "dry-run", from: "" }))
  }

  const provider = await resolveSmsProvider(orgId)

  const results: SmsSendResult[] = []

  let finalMediaUrls: string[] | undefined
  if (mediaUrls?.length) {
    finalMediaUrls = await ensurePublicMediaUrls(mediaUrls)
    if (!finalMediaUrls || finalMediaUrls.length < mediaUrls.length) {
      const mediaError =
        finalMediaUrls?.length === 0
          ? "Attachments could not be processed. Please try different files."
          : "Some attachments could not be processed. Please try again."
      throw new Error(mediaError)
    }
  }

  for (const num of to) {
    const formatted = formatPhoneE164(num)
    if (!formatted) throw new Error(`Invalid phone number: ${num}`)
    const carrier = (await lookupCarrier(formatted)) || "unknown"
    // Deterministic caller ID, resolved per recipient so a sticky recorded for an
    // earlier recipient in this batch is reused (sticky → DEFAULT_OUTBOUND_DID).
    const fromNumber = await resolveOutboundFrom({
      client: supabaseAdmin,
      buyerId,
      threadId: null,
      explicitFrom: null,
    })
    const sendRequest = async () => {
      const result = await provider.sendMessage({
        from: fromNumber,
        to: formatted,
        text: body,
        mediaUrls: finalMediaUrls,
        messagingProfileId,
      })
      log("sms", "Sent", { to: formatted, sid: result.id })
      return result
    }

    try {
      const data = await scheduleSMS(carrier, body, sendRequest)
      results.push({ to: formatted, sid: data.id, from: data.from })

      if (!isTest) {
        const { data: thread } = await supabaseAdmin
          .from("message_threads")
          .upsert(
            {
              buyer_id: buyerId,
              phone_number: normalizePhone(formatted),
              campaign_id: campaignId ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "buyer_id,phone_number" },
          )
          .select("id")
          .single()

        if (thread) {
          await supabaseAdmin.from("messages").insert({
            thread_id: thread.id,
            buyer_id: buyerId,
            direction: "outbound",
            from_number: formatPhoneE164(data.from) || data.from,
            to_number: formatted,
            body,
            provider_id: data.id,
            is_bulk: true,
            media_urls: finalMediaUrls?.length ? finalMediaUrls : null,
          })
        }

        // Single sticky writer (both stores) — the number actually sent. Non-test only.
        const sentFrom = formatPhoneE164(data.from) || fromNumber
        if (buyerId && sentFrom) {
          await recordStickyFrom({
            client: supabaseAdmin,
            buyerId,
            threadId: thread?.id ?? null,
            from: sentFrom,
          })
        }
      }
    } catch (err: any) {
      console.error("Failed to send SMS", err)
      throw new Error(`Failed to send SMS: ${err.message || err}`)
    }
  }

  return results
}
