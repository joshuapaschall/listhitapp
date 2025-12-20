import { SendFoxError, sendEmail } from "./sendfox-service"
import { supabaseAdmin } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { renderTemplate } from "@/lib/utils"

const log = createLogger("campaign-sender")

export const EMAIL_BATCH_SIZE = 50
const EMAIL_QUEUE_CONCURRENCY = Number(process.env.EMAIL_QUEUE_CONCURRENCY || 2)
const SENDFOX_SEND_DELAY_MS = Number(process.env.SENDFOX_SEND_DELAY_MS || 750)
const SENDFOX_RATE_BACKOFF_MS = Number(process.env.SENDFOX_RATE_BACKOFF_MS || 2000)
const SENDFOX_RATE_MAX_RETRY = Number(process.env.SENDFOX_RATE_MAX_RETRY || 3)
const SENDFOX_QUEUE_SPACING_MS = Number(process.env.SENDFOX_QUEUE_SPACING_MS || 500)

export interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  dryRun?: boolean
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

export async function sendEmailCampaign({ to, subject, html, dryRun }: EmailOptions): Promise<string> {
  const recipients = Array.isArray(to) ? to : [to]
  if (dryRun) {
    recipients.forEach((r) => log("email", "[DRY RUN]", { to: r, subject }))
    return "dry-run"
  }

  try {
    const data = (await sendEmail(recipients, subject, html)) as { id?: string }
    log("email", "Sent", { to: recipients.length, id: data?.id })
    return data?.id || ""
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

  async function sendWithBackoff(contact: string, subject: string, html: string, attempt = 0): Promise<string> {
    try {
      return await sendEmailCampaign({ to: contact, subject, html })
    } catch (err: any) {
      if (err instanceof SendFoxError && err.type === "rate_limited" && attempt < SENDFOX_RATE_MAX_RETRY) {
        const delay = SENDFOX_RATE_BACKOFF_MS * Math.max(1, attempt + 1)
        await sleep(delay)
        return sendWithBackoff(contact, subject, html, attempt + 1)
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
        const providerId = await sendWithBackoff(contact.email, subject, html)
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
      if (err instanceof SendFoxError && err.type === "rate_limited") {
        const retryAt = new Date(Date.now() + SENDFOX_RATE_BACKOFF_MS).toISOString()
        await supabase
          .from("email_campaign_queue")
          .update({
            status: "pending",
            scheduled_for: retryAt,
            error:
              err instanceof SendFoxError
                ? JSON.stringify({
                    status: err.status,
                    type: err.type,
                    details: err.details || err.message,
                  })
                : err?.message || "rate limited",
          })
          .eq("id", job.id)
        continue
      }
      const errorDetails =
        err instanceof SendFoxError
          ? JSON.stringify({ status: err.status, type: err.type, details: err.details || err.message })
          : err?.message || String(err)
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
