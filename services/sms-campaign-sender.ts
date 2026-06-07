import { supabaseAdmin } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { renderTemplate } from "@/lib/utils"
import { getUserMergeContext, type UserMergeContext } from "@/lib/user-context"
import { formatPhoneE164, normalizePhone } from "@/lib/dedup-utils"
import { getTelnyxApiKey } from "@/lib/voice-env"
import { insertNotification } from "@/lib/notifications"
import { evaluateSmsCampaignSafety, type SmsSafetyVerdict } from "@/lib/sms/sms-safety-guard"
import { isWithinQuietHours, nextSendTime, SMS_CAMPAIGN_MPM } from "@/lib/sms/area-code-timezone"
import { suppressBuyerSms } from "@/lib/sms/suppress"
import { resolveOutboundFrom, recordStickyFrom } from "@/lib/sender/sticky-sender"
import { ensurePublicMediaUrls } from "@/utils/mms.server"
import { resolveSmsProvider } from "@/lib/providers/sms"

const log = createLogger("sms-campaign-sender")

const SMS_QUEUE_CONCURRENCY = Number(process.env.SMS_QUEUE_CONCURRENCY || 5)
const SMS_QUEUE_WORKER_ID =
  process.env.SMS_QUEUE_WORKER_ID ||
  `sms-campaign-sender-${process.pid}-${Math.random().toString(36).slice(2, 8)}`
const SMS_QUEUE_LEASE_SECONDS = Number(process.env.SMS_QUEUE_LEASE_SECONDS || 300)
const SMS_QUEUE_MAX_ATTEMPTS = Number(process.env.SMS_QUEUE_MAX_ATTEMPTS || 8)
const SMS_QUEUE_BASE_BACKOFF_MS = Number(process.env.SMS_QUEUE_BASE_BACKOFF_MS || 2000)
const SMS_QUEUE_JITTER_MS = Number(process.env.SMS_QUEUE_JITTER_MS || 500)

const telnyxApiKey = getTelnyxApiKey()
const messagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID

type SmsQueueRecipient = {
  recipientId: string
  buyerId: string
  toNumber: string
  body: string
}

type QueueSmsCampaignPayload = {
  campaignId: string
  mediaUrls?: string[]
  recipients: SmsQueueRecipient[]
}

type SmsQueuePayload = {
  body: string
  mediaUrls?: string[]
  campaignId?: string
}

type TelnyxSendResult = {
  id: string
  from: string
}

function requireAdmin() {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client is not configured")
  }
  return supabaseAdmin
}

function isRetryableError(err: any) {
  if (!err) return false
  const status = err.status || err.statusCode
  if (status && Number(status) >= 500) return true
  if (status === 429) return true
  const code = (err.code || err.type || "").toString().toLowerCase()
  const retryableCodes = ["etimedout", "econnreset", "econnrefused", "enotfound", "eai_again"]
  if (retryableCodes.some((c) => code.includes(c))) return true
  const message = (err.message || "").toString().toLowerCase()
  if (message.includes("network error") || message.includes("timeout")) return true
  return false
}

function computeRetryDelayMs(attempt: number) {
  const cappedAttempt = Math.max(1, attempt)
  const base = SMS_QUEUE_BASE_BACKOFF_MS * Math.pow(2, cappedAttempt - 1)
  const jitter = Math.random() * SMS_QUEUE_JITTER_MS
  return base + jitter
}

async function updateRecipientStatus(
  campaignId: string | null,
  recipientId: string | undefined,
  updates: Record<string, any>,
) {
  if (!campaignId || !recipientId) return
  const supabase = requireAdmin()
  await supabase
    .from("campaign_recipients")
    .update(updates)
    .eq("campaign_id", campaignId)
    .eq("id", recipientId)
}

async function countSmsCampaignRecipients(campaignId: string) {
  const supabase = requireAdmin()
  const [{ count: sent }, { count: failures }, { count: optOuts }] = await Promise.all([
    supabase
      .from("campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .not("sent_at", "is", null),
    supabase
      .from("campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .not("rejected_at", "is", null),
    supabase
      .from("campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .not("unsubscribed_at", "is", null),
  ])

  return {
    sent: sent || 0,
    failures: failures || 0,
    optOuts: optOuts || 0,
  }
}

async function pauseSmsCampaignForSafety(
  campaignId: string,
  verdict: SmsSafetyVerdict & { trip: true; reason: "failure" | "optout" },
) {
  const supabase = requireAdmin()
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("status")
    .eq("id", campaignId)
    .maybeSingle()

  if (campaign?.status === "paused_by_safety") return

  await supabase
    .from("campaigns")
    .update({ status: "paused_by_safety" })
    .eq("id", campaignId)

  await supabase
    .from("sms_campaign_queue")
    .update({
      status: "paused",
      locked_at: null,
      lock_expires_at: null,
      locked_by: null,
    })
    .eq("campaign_id", campaignId)
    .in("status", ["pending", "processing"])

  await insertNotification({
    type: "campaign_paused_safety",
    title: "SMS campaign paused for safety",
    body: `Auto-paused: ${verdict.reason} rate exceeded the SMS safety threshold.`,
    metadata: {
      campaignId,
      channel: "sms",
      reason: verdict.reason,
      failureRate: verdict.failureRate,
      optOutRate: verdict.optOutRate,
    },
  })
}

async function refreshCampaignStatus(campaignId: string) {
  const supabase = requireAdmin()
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("status")
    .eq("id", campaignId)
    .maybeSingle()

  if (campaign?.status === "paused_by_safety") return

  const { count: pending } = await supabase
    .from("sms_campaign_queue")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .in("status", ["pending", "processing"])

  if (!pending || pending === 0) {
    const { count: errored } = await supabase
      .from("sms_campaign_queue")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .in("status", ["dead", "error"])
    const status = errored && errored > 0 ? "completed_with_errors" : "sent"
    await supabase.from("campaigns").update({ status }).eq("id", campaignId)
  } else {
    await supabase.from("campaigns").update({ status: "processing" }).eq("id", campaignId)
  }
}

async function sendSingleCampaignSms({
  buyerId,
  toNumber,
  body,
  mediaUrls,
  campaignId,
}: {
  buyerId: string
  toNumber: string
  body: string
  mediaUrls?: string[]
  campaignId?: string
}): Promise<TelnyxSendResult> {
  if (!telnyxApiKey || !messagingProfileId) {
    throw new Error("Telnyx environment variables are not properly configured")
  }

  const formatted = formatPhoneE164(toNumber)
  if (!formatted) throw new Error(`Invalid phone number: ${toNumber}`)

  // Deterministic caller ID via the shared resolver (sticky → DEFAULT_OUTBOUND_DID).
  const fromNumber = await resolveOutboundFrom({
    client: supabaseAdmin,
    buyerId,
    threadId: null,
    explicitFrom: null,
  })

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

  const provider = await resolveSmsProvider()
  const data = await provider.sendMessage({
    from: fromNumber,
    to: formatted,
    text: body,
    mediaUrls: finalMediaUrls,
    messagingProfileId,
  })
  const from = data.from
  log("sms", "Queued", { to: formatted, sid: data.id })

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
      from_number: formatPhoneE164(from) || from,
      to_number: formatted,
      body,
      provider_id: data.id,
      is_bulk: true,
      media_urls: finalMediaUrls?.length ? finalMediaUrls : null,
    })
  }

  // Single sticky writer (both stores) — the number actually sent.
  const sentFrom = formatPhoneE164(from) || fromNumber
  if (buyerId && sentFrom) {
    await recordStickyFrom({
      client: supabaseAdmin,
      buyerId,
      threadId: thread?.id ?? null,
      from: sentFrom,
    })
  }

  return { id: data.id, from }
}

export async function queueSmsCampaign({
  campaignId,
  mediaUrls,
  recipients,
}: QueueSmsCampaignPayload) {
  const supabase = requireAdmin()
  if (!recipients.length) return []

  const spacingMs = Math.ceil(60000 / SMS_CAMPAIGN_MPM)
  const scheduledStart = Date.now()
  const rows = recipients.map((recipient, idx) => ({
    campaign_id: campaignId,
    recipient_id: recipient.recipientId,
    buyer_id: recipient.buyerId,
    to_number: recipient.toNumber,
    payload: {
      body: recipient.body,
      mediaUrls,
      campaignId,
    },
    status: "pending",
    scheduled_for: new Date(scheduledStart + idx * spacingMs).toISOString(),
    max_attempts: SMS_QUEUE_MAX_ATTEMPTS,
  }))

  const queuedRows: any[] = []
  const batchSize = 1000
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { data, error } = await supabase
      .from("sms_campaign_queue")
      .upsert(batch, {
        onConflict: "campaign_id,recipient_id,to_number",
        ignoreDuplicates: true,
      })
      .select()

    if (error) {
      console.error("Failed to queue SMS campaign", error)
      throw error
    }

    queuedRows.push(...(data || []))
  }

  if (campaignId) {
    await supabase.from("campaigns").update({ status: "processing" }).eq("id", campaignId)
  }

  return queuedRows
}

export async function processSmsQueue(limit = 5, opts: { leaseSeconds?: number; workerId?: string } = {}) {
  const supabase = requireAdmin()
  const effectiveLimit = Math.max(1, limit || SMS_QUEUE_CONCURRENCY)
  const leaseSeconds = opts.leaseSeconds ?? SMS_QUEUE_LEASE_SECONDS
  const workerId = opts.workerId ?? SMS_QUEUE_WORKER_ID
  const { data: jobs, error } = await supabase.rpc("claim_sms_queue_jobs", {
    p_limit: effectiveLimit,
    p_worker: workerId,
    p_lease_seconds: leaseSeconds,
  })

  if (error) {
    console.error("Failed to claim SMS queue jobs", error)
    throw error
  }

  if (!jobs || jobs.length === 0) {
    return { processed: 0, sent: 0 }
  }

  const pausedCampaignIds = new Set<string>()
  const campaignIds = Array.from(
    new Set(
      (jobs as any[])
        .map((job) => job.campaign_id)
        .filter((campaignId): campaignId is string => Boolean(campaignId)),
    ),
  )

  for (const campaignId of campaignIds) {
    const counts = await countSmsCampaignRecipients(campaignId)
    const verdict = evaluateSmsCampaignSafety(counts)
    if (verdict.trip && verdict.reason) {
      pausedCampaignIds.add(campaignId)
      await pauseSmsCampaignForSafety(campaignId, {
        ...verdict,
        trip: true,
        reason: verdict.reason,
      })
    }
  }

  const { data: campaignRows } = campaignIds.length
    ? await supabase
        .from("campaigns")
        .select("id,user_id")
        .in("id", campaignIds)
    : { data: [] }
  const campaignUserIdMap = new Map(
    campaignRows?.map((row) => [row.id, row.user_id as string | null]) ?? [],
  )
  const campaignMergeContextEntries = await Promise.all(
    Array.from(campaignUserIdMap.entries()).map(async ([campaignId, userId]) => [
      campaignId,
      await getUserMergeContext(supabase, userId),
    ] as const),
  )
  const campaignMergeContextMap = new Map<string, UserMergeContext>(campaignMergeContextEntries)

  let sent = 0

  for (const rawJob of jobs) {
    const job = rawJob as any
    if (job.campaign_id && pausedCampaignIds.has(job.campaign_id)) {
      continue
    }
    const attemptNumber = Number(job.attempts ?? 0) + 1
    const maxAttempts = Number(job.max_attempts ?? SMS_QUEUE_MAX_ATTEMPTS)
    const now = new Date()
    if (!isWithinQuietHours(job.to_number, now)) {
      const scheduledFor = nextSendTime(job.to_number, now).toISOString()
      await supabase
        .from("sms_campaign_queue")
        .update({
          status: "pending",
          scheduled_for: scheduledFor,
          locked_at: null,
          lock_expires_at: null,
          locked_by: null,
        })
        .eq("id", job.id)
      log("sms", "Rescheduled SMS outside recipient quiet hours", {
        jobId: job.id,
        campaignId: job.campaign_id,
        toNumber: job.to_number,
        scheduledFor,
      })
      continue
    }
    try {
      const payload = job.payload as SmsQueuePayload
      if (!payload?.body) {
        throw new Error("Missing body payload for SMS job")
      }
      if (!job.buyer_id) {
        throw new Error("Missing buyer_id for SMS job")
      }

      const { data: buyer, error: buyerError } = await supabase
        .from("buyers")
        .select("id,fname,lname,email,phone,phone2,phone3")
        .eq("id", job.buyer_id)
        .maybeSingle()

      if (buyerError) throw buyerError
      if (!buyer) throw new Error("Buyer not found for SMS job")

      const senderContext = campaignMergeContextMap.get(job.campaign_id || payload.campaignId || "")
      const body = renderTemplate(payload.body, buyer, senderContext)
      const result = await sendSingleCampaignSms({
        buyerId: job.buyer_id,
        toNumber: job.to_number,
        body,
        mediaUrls: payload.mediaUrls,
        campaignId: payload.campaignId || job.campaign_id,
      })
      const sentAt = new Date().toISOString()
      sent += 1
      await supabase
        .from("sms_campaign_queue")
        .update({
          status: "sent",
          sent_at: sentAt,
          provider_id: result.id,
          attempts: attemptNumber,
          locked_at: null,
          lock_expires_at: null,
          locked_by: null,
          last_error: null,
          last_error_at: null,
        })
        .eq("id", job.id)
      await updateRecipientStatus(job.campaign_id, job.recipient_id, {
        status: "sent",
        sent_at: sentAt,
        provider_id: result.id,
        from_number: formatPhoneE164(result.from) || result.from || null,
        error: null,
      })
      if (job.campaign_id) {
        await refreshCampaignStatus(job.campaign_id)
      }
    } catch (err: any) {
      console.error("SMS queue dispatch failed", {
        campaignId: job.campaign_id,
        recipientId: job.recipient_id,
        toNumber: job.to_number,
        error: err,
      })
      const errorDetails = err?.message || String(err)
      const nowIso = new Date().toISOString()
      if (err?.telnyxCode === "40300") {
        await suppressBuyerSms(job.buyer_id, "carrier_opt_out")
      }
      const retryable = isRetryableError(err)
      const updates: Record<string, any> = {
        attempts: attemptNumber,
        locked_at: null,
        lock_expires_at: null,
        locked_by: null,
        last_error: errorDetails,
        last_error_at: nowIso,
      }
      if (retryable && attemptNumber < maxAttempts) {
        const retryAt = new Date(Date.now() + computeRetryDelayMs(attemptNumber)).toISOString()
        updates.status = "pending"
        updates.scheduled_for = retryAt
      } else {
        updates.status = retryable ? "dead" : "error"
      }
      await supabase.from("sms_campaign_queue").update(updates).eq("id", job.id)
      if (updates.status !== "pending") {
        await updateRecipientStatus(job.campaign_id, job.recipient_id, {
          status: "error",
          error: errorDetails,
        })
      }
      if (job.campaign_id && !pausedCampaignIds.has(job.campaign_id)) {
        await refreshCampaignStatus(job.campaign_id)
      }
    }
  }

  return { processed: jobs.length, sent }
}
