import { supabase } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { scheduleSMS, lookupCarrier } from "@/lib/sms-rate-limiter"
import { normalizePhone, formatPhoneE164 } from "@/lib/dedup-utils"
import { TELNYX_API_URL, getTelnyxApiKey } from "@/lib/voice-env"
import { ensurePublicMediaUrls } from "@/utils/mms.server"
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
  buyerId: string
  to: string[]
  body: string
  campaignId?: string
  mediaUrls?: string[]
  dryRun?: boolean
}

export async function sendCampaignSMS({ buyerId, to, body, mediaUrls, dryRun, campaignId }: SmsOptions): Promise<SmsSendResult[]> {
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

  const url = `${TELNYX_API_URL}/messages`

  let fromNumber: string | null = null
  try {
    const { data } = await supabase
      .from("buyer_sms_senders")
      .select("from_number")
      .eq("buyer_id", buyerId)
      .maybeSingle()
    if (data?.from_number) {
      fromNumber = formatPhoneE164(data.from_number) || data.from_number
    }
  } catch (err) {
    console.error("Failed to fetch sticky sender", err)
  }

  const results: SmsSendResult[] = []

  let finalMediaUrls: string[] | undefined
  if (mediaUrls?.length) {
    finalMediaUrls = await ensurePublicMediaUrls(mediaUrls)
  }

  for (const num of to) {
    const formatted = formatPhoneE164(num)
    if (!formatted) throw new Error(`Invalid phone number: ${num}`)
    const carrier = (await lookupCarrier(formatted)) || "unknown"
    const payload: Record<string, any> = {
      to: formatted,
      text: body,
      messaging_profile_id: messagingProfileId,
    }
    if (finalMediaUrls?.length) {
      payload.media_urls = finalMediaUrls
    }
    if (fromNumber) {
      payload.from = fromNumber
    }

    const sendRequest = async () => {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${telnyxApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const text = await response.text()
        console.error("Telnyx error", text)
        let msg = `Telnyx API error: ${response.status}`
        try {
          const err = JSON.parse(text)
          if (err.errors && err.errors[0]?.detail) msg = err.errors[0].detail
        } catch {}
        throw new Error(msg)
      }

      const json = await response.json()
      const data = json.data as { id: string; from: any }
      const from = typeof data.from === "string" ? data.from : data.from?.phone_number || ""
      log("sms", "Sent", { to: formatted, sid: data.id })

      if (!fromNumber && from) {
        try {
          const normalized = formatPhoneE164(from) || from
          await supabase
            .from("buyer_sms_senders")
            .insert([{ buyer_id: buyerId, from_number: normalized }])
          fromNumber = normalized
        } catch (err) {
          console.error("Failed to save sticky sender", err)
        }
      }

      return { id: data.id, from }
    }

    try {
      const data = await scheduleSMS(carrier, body, sendRequest)
      results.push({ to: formatted, sid: data.id, from: data.from })

      const { data: thread } = await supabase
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
        await supabase.from("messages").insert({
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
    } catch (err: any) {
      console.error("Failed to send SMS", err)
      throw new Error(`Failed to send SMS: ${err.message || err}`)
    }
  }

  return results
}
