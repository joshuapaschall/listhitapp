import { supabaseAdmin } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { renderTemplate } from "@/lib/utils"
import { sendSesEmail } from "@/lib/ses"
import { appendUnsubscribeFooter, buildUnsubscribeUrl } from "@/lib/unsubscribe"

const log = createLogger("campaign-sender")

export const EMAIL_BATCH_SIZE = 50
const EMAIL_QUEUE_CONCURRENCY = Number(process.env.EMAIL_QUEUE_CONCURRENCY || 2)
const SENDFOX_SEND_DELAY_MS = Number(process.env.SENDFOX_SEND_DELAY_MS || 750)
const SENDFOX_RATE_BACKOFF_MS = Number(process.env.SENDFOX_RATE_BACKOFF_MS || 2000)
const SENDFOX_RATE_MAX_RETRY = Number(process.env.SENDFOX_RATE_MAX_RETRY || 3)
const SENDFOX_QUEUE_SPACING_MS = Number(process.env.SENDFOX_QUEUE_SPACING_MS || 500)
const SITE_URL =
  process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || process.env.DISPOTOOL_BASE_URL
const EMAIL_PHYSICAL_ADDRESS = process.env.EMAIL_PHYSICAL_ADDRESS || "ListHit CRM · 123 Main St · Anytown, USA"

export interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  dryRun?: boolean
  tags?: Record<string, string | null | undefined>
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
  contacts: EmailContactPayload[]
  campaignId?: string
  templateId?: string
  listIds?: number[]
}

function chunk<T>(arr: T[], size: number) {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
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

export async function sendEmailCampaign({ to, subject, html, dryRun, tags }: EmailOptions): Promise<string> {
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
  const batches = chunk(payload.contacts || [], EMAIL_BATCH_SIZE)
  if (!batches.length) return []
  const baseTime = new Date(scheduledFor).getTime()
  const rows = batches.map((batch, idx) => ({
    campaign_id: payload.campaignId ?? null,
    payload: { ...payload, contacts: batch },
    contact_count: batch.length,
    scheduled_for: new Date(baseTime + idx * SENDFOX_QUEUE_SPACING_MS).toISOString(),
    created_by: opts.createdBy ?? null,
    status: "pending",
  }))

  const { data, error } = await supabase
    .from("email_campaign_queue")
    .insert(rows)
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
    await supabase.from("campaigns").update({ status: "sent" }).eq("id", campaignId)
  }
}

export async function processEmailQueue(limit = 5) {
  const supabase = requireAdmin()
  const now = new Date().toISOString()
  const effectiveLimit = Math.min(limit, EMAIL_QUEUE_CONCURRENCY)
  const { data: jobs, error } = await supabase
    .from("email_campaign_queue")
    .select("id,payload,campaign_id,status")
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(effectiveLimit)

  if (error) {
    console.error("Failed to fetch email queue", error)
    throw error
  }

  let sent = 0

  async function sendWithBackoff(
    contact: string,
    subject: string,
    html: string,
    tags?: Record<string, string | null | undefined>,
    attempt = 0,
  ): Promise<string> {
    try {
      return await sendEmailCampaign({ to: contact, subject, html, tags })
    } catch (err: any) {
      if (isSesRateLimitError(err) && attempt < SENDFOX_RATE_MAX_RETRY) {
        const delay = SENDFOX_RATE_BACKOFF_MS * Math.max(1, attempt + 1)
        await sleep(delay)
        return sendWithBackoff(contact, subject, html, tags, attempt + 1)
      }
      throw err
    }
  }

  for (const job of jobs || []) {
    let currentContactEmail: string | null = null
    await supabase
      .from("email_campaign_queue")
      .update({ status: "processing" })
      .eq("id", job.id)

    try {
      const payload = (job as any).payload as EmailQueuePayload
      let lastProvider: string | null = null

      for (const contact of payload.contacts || []) {
        currentContactEmail = contact.email
        const context: Record<string, any> = {
          fname: contact.firstName,
          lname: contact.lastName,
          first_name: contact.firstName,
          last_name: contact.lastName,
        }
        const subject = renderTemplate(payload.subject, context)
        let html = renderTemplate(payload.html, context)
        try {
          const { replaceUrlsWithShortLinks } = await import("./shortio-service")
          const replaced = await replaceUrlsWithShortLinks(html)
          html = replaced.html
        } catch (err) {
          console.error("Short.io replacement failed", err)
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
        })
        html = appendUnsubscribeFooter(html, {
          unsubscribeUrl,
          physicalAddress: EMAIL_PHYSICAL_ADDRESS,
        })
        const tags = {
          recipient_id: contact.recipientId,
          buyer_id: contact.buyerId,
        }
        const providerId = await sendWithBackoff(contact.email, subject, html, tags)
        lastProvider = providerId
        sent += 1
        await updateRecipientStatus(job.campaign_id, contact.recipientId, {
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_id: providerId,
        })
        await sleep(SENDFOX_SEND_DELAY_MS)
      }

      await supabase
        .from("email_campaign_queue")
        .update({ status: "sent", provider_id: lastProvider, error: null })
        .eq("id", job.id)

      if (job.campaign_id) {
        await refreshCampaignStatus(job.campaign_id)
      }
    } catch (err: any) {
      console.error("Queue dispatch failed", {
        campaignId: job.campaign_id,
        contactEmail: currentContactEmail,
        error: err,
      })
      if (isSesRateLimitError(err)) {
        const retryAt = new Date(Date.now() + SENDFOX_RATE_BACKOFF_MS).toISOString()
        await supabase
          .from("email_campaign_queue")
          .update({
            status: "pending",
            scheduled_for: retryAt,
            error: err?.message || "rate limited",
          })
          .eq("id", job.id)
        continue
      }
      const errorDetails = err?.message || String(err)
      await supabase
        .from("email_campaign_queue")
        .update({ status: "error", error: errorDetails })
        .eq("id", job.id)

      if (job.campaign_id) {
        await supabase.from("campaigns").update({ status: "error" }).eq("id", job.campaign_id)
      }
    }
  }

  return { processed: jobs?.length || 0, sent }
}
