import { supabaseAdmin } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { renderTemplate } from "@/lib/utils"
import { sendSesEmail } from "@/lib/ses"
import { getSesQuota } from "@/lib/ses-quota"
import { appendUnsubscribeFooter, buildUnsubscribeUrl } from "@/lib/unsubscribe"

const log = createLogger("campaign-sender")

const EMAIL_QUEUE_CONCURRENCY = Number(process.env.EMAIL_QUEUE_CONCURRENCY || 2)
const EMAIL_SEND_DELAY_MS = Number(
  process.env.EMAIL_SEND_DELAY_MS ?? process.env.SENDFOX_SEND_DELAY_MS ?? 750,
)
const EMAIL_RETRY_BACKOFF_MS = Number(
  process.env.EMAIL_RETRY_BACKOFF_MS ?? process.env.SENDFOX_RATE_BACKOFF_MS ?? 2000,
)
const EMAIL_RATE_MAX_RETRY = Number(
  process.env.EMAIL_RATE_MAX_RETRY ?? process.env.SENDFOX_RATE_MAX_RETRY ?? 3,
)
const EMAIL_RATE_HEADROOM = Number(process.env.EMAIL_RATE_HEADROOM ?? 0.8)
const EMAIL_SPACING_MS_MIN = Number(process.env.EMAIL_SPACING_MS_MIN ?? 0)
const EMAIL_SPACING_MS_MAX = Number(process.env.EMAIL_SPACING_MS_MAX ?? 2000)
const EMAIL_QUEUE_WORKER_ID =
  process.env.EMAIL_QUEUE_WORKER_ID ||
  `campaign-sender-${process.pid}-${Math.random().toString(36).slice(2, 8)}`
const EMAIL_QUEUE_LEASE_SECONDS = Number(process.env.EMAIL_QUEUE_LEASE_SECONDS || 300)
const EMAIL_QUEUE_MAX_ATTEMPTS = Number(process.env.EMAIL_QUEUE_MAX_ATTEMPTS || 8)
const EMAIL_QUEUE_BASE_BACKOFF_MS = Number(process.env.EMAIL_QUEUE_BASE_BACKOFF_MS || 2000)
const EMAIL_QUEUE_JITTER_MS = Number(process.env.EMAIL_QUEUE_JITTER_MS || 500)
const SITE_URL =
  process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || process.env.DISPOTOOL_BASE_URL
const EMAIL_PHYSICAL_ADDRESS = process.env.EMAIL_PHYSICAL_ADDRESS || "ListHit CRM · 123 Main St · Anytown, USA"

const emailShortlinksDisabled = () => (process.env.EMAIL_DISABLE_SHORTLINKS ?? "1") !== "0"

export interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  dryRun?: boolean
  tags?: Record<string, string | null | undefined>
  unsubscribeUrl?: string
}

export interface EmailContactPayload {
  email: string
  firstName?: string
  lastName?: string
  recipientId?: string
  buyerId?: string
}

export interface EmailQueuePayload {
  subject: string
  html: string
  contact?: EmailContactPayload
  contacts?: EmailContactPayload[]
  campaignId?: string
  templateId?: string
  listIds?: number[]
}

function requireAdmin() {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client is not configured")
  }
  return supabaseAdmin
}

function sleep(ms: number) {
  if (!ms) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isSesRateLimitError(err: any) {
  if (!err) return false
  const code = (err.name || err.Code || err.code || "").toString().toLowerCase()
  if (code.includes("throttl") || code.includes("rate")) return true
  const status = err.$metadata?.httpStatusCode
  return status === 429
}

function isRetryableError(err: any) {
  if (!err) return false
  if (isSesRateLimitError(err)) return true
  const status = err.$metadata?.httpStatusCode || err.status || err.statusCode
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
  const base = EMAIL_QUEUE_BASE_BACKOFF_MS * Math.pow(2, cappedAttempt - 1)
  const jitter = Math.random() * EMAIL_QUEUE_JITTER_MS
  return base + jitter
}

export async function sendEmailCampaign({ to, subject, html, dryRun, tags, unsubscribeUrl }: EmailOptions): Promise<string> {
  const recipients = Array.isArray(to) ? to : [to]
  if (dryRun) {
    recipients.forEach((r) => log("email", "[DRY RUN]", { to: r, subject }))
    return "dry-run"
  }

  try {
    let lastMessageId = ""
    for (const recipient of recipients) {
      const response = await sendSesEmail({
        to: recipient,
        subject,
        html,
        tags,
        unsubscribeUrl,
      })
      lastMessageId = response.MessageId || ""
    }
    log("email", "Sent", { to: recipients.length, id: lastMessageId })
    return lastMessageId
  } catch (err) {
    console.error("Failed to send email", err)
    throw err
  }
}

export async function queueEmailCampaign(
  payload: EmailQueuePayload,
  opts: { scheduledFor?: string | Date; createdBy?: string } = {},
) {
  const supabase = requireAdmin()
  const scheduledFor = opts.scheduledFor ? new Date(opts.scheduledFor) : new Date()
  const contacts = payload.contacts || []
  if (!contacts.length) return []
  const quota = await getSesQuota()
  const maxSendRate = Number.isFinite(quota.maxSendRate) ? quota.maxSendRate : 0
  const max24HourSend = Number.isFinite(quota.max24HourSend) ? quota.max24HourSend : 0
  const sentLast24Hours = Number.isFinite(quota.sentLast24Hours) ? quota.sentLast24Hours : 0
  const rateHeadroom =
    Number.isFinite(EMAIL_RATE_HEADROOM) && EMAIL_RATE_HEADROOM > 0
      ? EMAIL_RATE_HEADROOM
      : 0.8
  const targetRate = Math.floor(maxSendRate * rateHeadroom)
  const baseSpacingMs = targetRate >= 1 ? Math.ceil(1000 / targetRate) : 1000
  const spacingMin = Number.isFinite(EMAIL_SPACING_MS_MIN) ? EMAIL_SPACING_MS_MIN : 0
  const spacingMax = Number.isFinite(EMAIL_SPACING_MS_MAX) ? EMAIL_SPACING_MS_MAX : 2000
  const spacingMs = Math.min(Math.max(baseSpacingMs, spacingMin), spacingMax)
  const windowSizeRaw = Math.floor(max24HourSend * 0.9)
  const windowSize =
    max24HourSend === -1 || !Number.isFinite(windowSizeRaw) || windowSizeRaw < 1
      ? Infinity
      : windowSizeRaw
  const remaining24h =
    max24HourSend === -1 ? Infinity : Math.max(0, Math.floor(max24HourSend - sentLast24Hours))

  log("queue", "SES quota scheduling", {
    maxSendRate,
    max24HourSend,
    sentLast24Hours,
    remaining24h,
    spacingMs,
    windowSize: windowSize === Infinity ? "unlimited" : windowSize,
  })
  const baseTime = scheduledFor.getTime()
  const rows = contacts.map((contact, idx) => ({
    campaign_id: payload.campaignId ?? null,
    recipient_id: contact.recipientId ?? null,
    buyer_id: contact.buyerId ?? null,
    to_email: contact.email,
    payload: {
      subject: payload.subject,
      html: payload.html,
      campaignId: payload.campaignId,
      contact: {
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        recipientId: contact.recipientId,
        buyerId: contact.buyerId,
      },
    },
    scheduled_for: (() => {
      const idxEffective = idx
      if (windowSize === Infinity) {
        return new Date(baseTime + idxEffective * spacingMs).toISOString()
      }
      const dayOffset = Math.floor((sentLast24Hours + idxEffective) / windowSize)
      const withinWindowIndex = (sentLast24Hours + idxEffective) % windowSize
      return new Date(
        baseTime + dayOffset * 24 * 60 * 60 * 1000 + withinWindowIndex * spacingMs,
      ).toISOString()
    })(),
    created_by: opts.createdBy ?? null,
    status: "pending",
    max_attempts: EMAIL_QUEUE_MAX_ATTEMPTS,
  }))

  const { data, error } = await supabase
    .from("email_campaign_queue")
    .upsert(rows, {
      onConflict: "campaign_id,recipient_id",
      ignoreDuplicates: true,
    })
    .select()

  if (error) {
    console.error("Failed to queue email campaign", error)
    throw error
  }

  if (payload.campaignId) {
    await supabase.from("campaigns").update({ status: "processing" }).eq("id", payload.campaignId)
  }

  return data || []
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

async function refreshCampaignStatus(campaignId: string) {
  const supabase = requireAdmin()
  const { count: pending } = await supabase
    .from("email_campaign_queue")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .in("status", ["pending", "processing"])

  if (!pending || pending === 0) {
    const { count: errored } = await supabase
      .from("email_campaign_queue")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .in("status", ["dead", "error"])
    const status = errored && errored > 0 ? "completed_with_errors" : "sent"
    await supabase.from("campaigns").update({ status }).eq("id", campaignId)
  } else {
    await supabase.from("campaigns").update({ status: "processing" }).eq("id", campaignId)
  }
}

export async function processEmailQueue(limit = 5, opts: { leaseSeconds?: number; workerId?: string } = {}) {
  const supabase = requireAdmin()
  const effectiveLimit = Math.max(1, limit || EMAIL_QUEUE_CONCURRENCY)
  const leaseSeconds = opts.leaseSeconds ?? EMAIL_QUEUE_LEASE_SECONDS
  const workerId = opts.workerId ?? EMAIL_QUEUE_WORKER_ID
  const { data: jobs, error } = await supabase.rpc("claim_email_queue_jobs", {
    p_limit: effectiveLimit,
    p_worker: workerId,
    p_lease_seconds: leaseSeconds,
  })

  if (error) {
    console.error("Failed to claim email queue jobs", error)
    throw error
  }

  if (!jobs || jobs.length === 0) {
    return { processed: 0, sent: 0 }
  }

  let sent = 0

  async function sendWithBackoff(
    contact: string,
    subject: string,
    html: string,
    tags?: Record<string, string | null | undefined>,
    unsubscribeUrl?: string,
    attempt = 0,
  ): Promise<string> {
    try {
      return await sendEmailCampaign({ to: contact, subject, html, tags, unsubscribeUrl })
    } catch (err: any) {
      if (isSesRateLimitError(err) && attempt < EMAIL_RATE_MAX_RETRY) {
        const delay = EMAIL_RETRY_BACKOFF_MS * Math.max(1, attempt + 1)
        await sleep(delay)
        return sendWithBackoff(contact, subject, html, tags, unsubscribeUrl, attempt + 1)
      }
      throw err
    }
  }

  for (const rawJob of jobs) {
    const job = rawJob as any
    let currentContactEmail: string | null = null
    const attemptNumber = Number(job.attempts ?? 0) + 1
    const maxAttempts = Number(job.max_attempts ?? EMAIL_QUEUE_MAX_ATTEMPTS)
    try {
      const payload = job.payload as EmailQueuePayload
      const contact = payload.contact
      if (!contact) {
        throw new Error("Missing contact payload for email job")
      }
      currentContactEmail = contact.email
      const context: Record<string, any> = {
        fname: contact.firstName,
        lname: contact.lastName,
        first_name: contact.firstName,
        last_name: contact.lastName,
      }
      const subject = renderTemplate(payload.subject, context)
      let html = renderTemplate(payload.html, context)
      if (!emailShortlinksDisabled()) {
        try {
          const { replaceUrlsWithShortLinks } = await import("./shortio-service")
          const replaced = await replaceUrlsWithShortLinks(html, { anchorHrefOnly: true })
          html = replaced.html
        } catch (err) {
          console.error("Short.io replacement failed", err)
        }
      }
      if (!SITE_URL) {
        throw new Error("SITE_URL is not configured")
      }
      if (!contact.buyerId) {
        throw new Error("buyerId is required for unsubscribe link")
      }
      const unsubscribeUrl = buildUnsubscribeUrl({
        buyerId: contact.buyerId,
        email: contact.email,
        baseUrl: SITE_URL,
        campaignId: payload.campaignId,
        recipientId: contact.recipientId,
      })
      html = appendUnsubscribeFooter(html, {
        unsubscribeUrl,
        physicalAddress: EMAIL_PHYSICAL_ADDRESS,
      })
      const tags = {
        campaign_id: payload.campaignId,
        recipient_id: contact.recipientId,
        buyer_id: contact.buyerId,
      }
      const providerId = await sendWithBackoff(contact.email, subject, html, tags, unsubscribeUrl)
      const sentAt = new Date().toISOString()
      sent += 1
      await supabase
        .from("email_campaign_queue")
        .update({
          status: "sent",
          sent_at: sentAt,
          provider_id: providerId,
          attempts: attemptNumber,
          locked_at: null,
          lock_expires_at: null,
          locked_by: null,
          last_error: null,
          last_error_at: null,
        })
        .eq("id", job.id)
      await updateRecipientStatus(job.campaign_id, contact.recipientId, {
        status: "sent",
        sent_at: sentAt,
        provider_id: providerId,
      })
      if (job.campaign_id) {
        await refreshCampaignStatus(job.campaign_id)
      }
      await sleep(EMAIL_SEND_DELAY_MS)
    } catch (err: any) {
      console.error("Queue dispatch failed", {
        campaignId: job.campaign_id,
        contactEmail: currentContactEmail,
        error: err,
      })
      const errorDetails = err?.message || String(err)
      const nowIso = new Date().toISOString()
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
      await supabase.from("email_campaign_queue").update(updates).eq("id", job.id)
      if (updates.status !== "pending") {
        await updateRecipientStatus(job.campaign_id, job.recipient_id, {
          status: "error",
          error: errorDetails,
        })
      }
      if (job.campaign_id) {
        await refreshCampaignStatus(job.campaign_id)
      }
    }
  }

  return { processed: jobs.length, sent }
}
