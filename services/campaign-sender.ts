import { supabaseAdmin } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { renderTemplate } from "@/lib/utils"
import { sendSesEmail } from "@/lib/ses"
import { appendUnsubscribeFooter, buildUnsubscribeUrl } from "@/lib/unsubscribe"

const log = createLogger("campaign-sender")

const EMAIL_QUEUE_CONCURRENCY = Number(process.env.EMAIL_QUEUE_CONCURRENCY || 2)
const SENDFOX_SEND_DELAY_MS = Number(process.env.SENDFOX_SEND_DELAY_MS || 750)
const SENDFOX_RATE_BACKOFF_MS = Number(process.env.SENDFOX_RATE_BACKOFF_MS || 2000)
const SENDFOX_RATE_MAX_RETRY = Number(process.env.SENDFOX_RATE_MAX_RETRY || 3)
const SENDFOX_QUEUE_SPACING_MS = Number(process.env.SENDFOX_QUEUE_SPACING_MS || 500)
const EMAIL_QUEUE_WORKER_ID = process.env.EMAIL_QUEUE_WORKER_ID || `campaign-sender-${process.pid}`
const EMAIL_QUEUE_LEASE_SECONDS = Number(process.env.EMAIL_QUEUE_LEASE_SECONDS || 60)
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
  const base = Math.min(10 * 60 * 1000, Math.pow(2, cappedAttempt) * 1000)
  const jitter = Math.random() * 0.25 * base
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
  const scheduledFor = opts.scheduledFor
    ? new Date(opts.scheduledFor).toISOString()
    : new Date().toISOString()
  const contacts = payload.contacts || []
  if (!contacts.length) return []
  const baseTime = new Date(scheduledFor).getTime()
  const rows = contacts.map((contact, idx) => ({
    campaign_id: payload.campaignId ?? null,
    recipient_id: contact.recipientId ?? null,
    buyer_id: contact.buyerId ?? null,
    to_email: contact.email,
    payload: {
      campaignId: payload.campaignId,
      subject: payload.subject,
      html: payload.html,
      contact,
    },
    contact_count: 1,
    scheduled_for: new Date(baseTime + idx * SENDFOX_QUEUE_SPACING_MS).toISOString(),
    created_by: opts.createdBy ?? null,
    status: "pending",
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
  const effectiveLimit = Math.min(limit, EMAIL_QUEUE_CONCURRENCY)
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
      if (isSesRateLimitError(err) && attempt < SENDFOX_RATE_MAX_RETRY) {
        const delay = SENDFOX_RATE_BACKOFF_MS * Math.max(1, attempt + 1)
        await sleep(delay)
        return sendWithBackoff(contact, subject, html, tags, unsubscribeUrl, attempt + 1)
      }
      throw err
    }
  }

  for (const job of jobs || []) {
    let currentContactEmail: string | null = null
    try {
      const payload = (job as any).payload as EmailQueuePayload
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
          locked_at: null,
          lock_expires_at: null,
          locked_by: null,
          last_error: null,
          last_error_at: null,
        })
        .eq("id", (job as any).id)
      await updateRecipientStatus(job.campaign_id, contact.recipientId, {
        status: "sent",
        sent_at: sentAt,
        provider_id: providerId,
      })
      if (job.campaign_id) {
        await refreshCampaignStatus(job.campaign_id)
      }
      await sleep(SENDFOX_SEND_DELAY_MS)
    } catch (err: any) {
      console.error("Queue dispatch failed", {
        campaignId: job.campaign_id,
        contactEmail: currentContactEmail,
        error: err,
      })
      const errorDetails = err?.message || String(err)
      const nowIso = new Date().toISOString()
      const attempts = ((job as any).attempts ?? 0) + 1
      const maxAttempts = (job as any).max_attempts || 8
      const retryable = isRetryableError(err)
      const updates: Record<string, any> = {
        attempts,
        locked_at: null,
        lock_expires_at: null,
        locked_by: null,
        last_error: errorDetails,
        last_error_at: nowIso,
      }
      if (retryable) {
        const delayMs = computeRetryDelayMs(attempts)
        const retryAt = new Date(Date.now() + delayMs).toISOString()
        const reachedMax = attempts >= maxAttempts
        updates.status = reachedMax ? "dead" : "pending"
        updates.scheduled_for = reachedMax ? nowIso : retryAt
      } else {
        updates.status = "error"
      }
      await supabase.from("email_campaign_queue").update(updates).eq("id", (job as any).id)
      if (!retryable) {
        await updateRecipientStatus(job.campaign_id, (job as any).recipient_id, {
          status: "error",
          error: errorDetails,
        })
      } else if (updates.status === "dead") {
        await updateRecipientStatus(job.campaign_id, (job as any).recipient_id, {
          status: "error",
          error: errorDetails,
        })
      }
      if (job.campaign_id) {
        await refreshCampaignStatus(job.campaign_id)
      }
    }
  }

  return { processed: jobs?.length || 0, sent }
}
