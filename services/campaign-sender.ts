import { supabaseAdmin } from "@/lib/supabase"
import { resolveOrgIdForUser } from "@/lib/auth/org-context"
import { createLogger } from "@/lib/logger"
import { renderTemplate } from "@/lib/utils"
import { getUserMergeContext, type UserMergeContext } from "@/lib/user-context"
import { sendSesEmail } from "@/lib/ses"
import { getSesQuota } from "@/lib/ses-quota"
import { appendUnsubscribeFooter, buildUnsubscribeUrl } from "@/lib/unsubscribe"
import { evaluateCampaignSafety, type CampaignSafetyVerdict } from "@/lib/email/deliverability-guard"
import { insertNotification } from "@/lib/notifications"

const log = createLogger("campaign-sender")

const EMAIL_QUEUE_CONCURRENCY = Number(process.env.EMAIL_QUEUE_CONCURRENCY || 50)
const EMAIL_SEND_DELAY_MS = Number(
  process.env.EMAIL_SEND_DELAY_MS ?? process.env.SENDFOX_SEND_DELAY_MS ?? 0,
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

const BUSINESS_ADDRESS_PLACEHOLDER = "[Your business address]"

const emailShortlinksDisabled = () => (process.env.EMAIL_DISABLE_SHORTLINKS ?? "1") !== "0"

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function compactParts(parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part))
}

async function stampBusinessAddressForCampaign(html: string, campaignId?: string | null) {
  if (!campaignId || !html.includes(BUSINESS_ADDRESS_PLACEHOLDER)) return html

  const supabase = requireAdmin()
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("user_id")
    .eq("id", campaignId)
    .maybeSingle()

  if (campaignError || !campaign?.user_id) {
    if (campaignError) console.error("Failed to load campaign owner for email footer stamping", campaignError)
    return html
  }

  const orgId = await resolveOrgIdForUser(campaign.user_id)
  if (!orgId) return html

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("name,business_name,address_line1,address_line2,city,state,zip")
    .eq("id", orgId)
    .maybeSingle()

  if (organizationError || !organization) {
    if (organizationError) console.error("Failed to load organization for email footer stamping", organizationError)
    return html
  }

  const locality = compactParts([organization.city, organization.state, organization.zip]).join(", ")
  const addressLines = compactParts([
    organization.address_line1,
    organization.address_line2,
    locality,
  ])

  if (!addressLines.length) return html

  const stampedAddress = compactParts([
    organization.business_name ?? organization.name,
    ...addressLines,
  ])
    .map(escapeHtml)
    .join("<br/>")

  // Build-time stamping keeps DEFAULT_BRAND generic while persisting campaign-specific org footer text.
  return html.split(BUSINESS_ADDRESS_PLACEHOLDER).join(stampedAddress)
}

export interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  dryRun?: boolean
  fromEmail?: string
  fromName?: string
  replyTo?: string
  tags?: Record<string, string | null | undefined>
  unsubscribeUrl?: string
}

export interface EmailContactPayload {
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  recipientId?: string
  buyerId?: string
}

export interface EmailQueuePayload {
  subject?: string
  html?: string
  contact?: EmailContactPayload
  contacts?: EmailContactPayload[]
  campaignId?: string
  fromEmail?: string
  fromName?: string
  replyTo?: string
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

export async function sendEmailCampaign({
  to,
  subject,
  html,
  dryRun,
  fromEmail,
  fromName,
  replyTo,
  tags,
  unsubscribeUrl,
}: EmailOptions): Promise<string> {
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
        fromEmail,
        fromName,
        replyTo,
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

  if (payload.campaignId) {
    const stampedHtml = await stampBusinessAddressForCampaign(payload.html ?? "", payload.campaignId)
    const { error: contentError } = await supabase
      .from("email_campaign_content")
      .upsert(
        {
          campaign_id: payload.campaignId,
          subject: payload.subject ?? "",
          html: stampedHtml,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "campaign_id" },
      )

    if (contentError) {
      console.error("Failed to store email campaign content", contentError)
      throw contentError
    }
  }

  const baseTime = scheduledFor.getTime()
  const rows = contacts.map((contact, idx) => ({
    campaign_id: payload.campaignId ?? null,
    recipient_id: contact.recipientId ?? null,
    buyer_id: contact.buyerId ?? null,
    to_email: contact.email,
    payload: {
      ...(payload.campaignId
        ? {}
        : {
            subject: payload.subject,
            html: payload.html,
          }),
      campaignId: payload.campaignId,
      fromEmail: payload.fromEmail,
      fromName: payload.fromName,
      replyTo: payload.replyTo,
      contact: {
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        phone: contact.phone,
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
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("status")
    .eq("id", campaignId)
    .maybeSingle()

  if (campaign?.status === "paused_by_safety") return

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

async function countCampaignRecipients(campaignId: string) {
  const supabase = requireAdmin()
  const [{ count: sent }, { count: hardBounces }, { count: complaints }] = await Promise.all([
    supabase
      .from("campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .not("sent_at", "is", null),
    supabase
      .from("campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("bounce_type", "Permanent"),
    supabase
      .from("campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .not("complained_at", "is", null),
  ])

  return {
    sent: sent || 0,
    hardBounces: hardBounces || 0,
    complaints: complaints || 0,
  }
}

async function pauseCampaignForSafety(
  campaignId: string,
  verdict: CampaignSafetyVerdict & { trip: true; reason: "bounce" | "complaint" },
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
    .from("email_campaign_queue")
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
    title: "Campaign paused for safety",
    body: `Auto-paused: ${verdict.reason} rate exceeded the safety threshold.`,
    metadata: {
      campaignId,
      reason: verdict.reason,
      bounceRate: verdict.bounceRate,
      complaintRate: verdict.complaintRate,
    },
  })
}

export async function processEmailQueue(limit = 5, opts: { leaseSeconds?: number; workerId?: string } = {}) {
  const supabase = requireAdmin()
  const { data: latestReputationSnapshot, error: reputationError } = await supabase
    .from("ses_reputation_snapshots")
    .select("sending_state")
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (reputationError) {
    console.error("Failed to read SES reputation snapshot", reputationError)
  }

  if (latestReputationSnapshot?.sending_state === "frozen") {
    log("queue", "Email sending frozen by account reputation guard")
    return { processed: 0, sent: 0, frozen: true }
  }

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

  const pausedCampaignIds = new Set<string>()
  const campaignIds = Array.from(
    new Set(
      (jobs as any[])
        .map((job) => job.campaign_id)
        .filter((campaignId): campaignId is string => Boolean(campaignId)),
    ),
  )

  for (const campaignId of campaignIds) {
    const counts = await countCampaignRecipients(campaignId)
    const verdict = evaluateCampaignSafety(counts)
    if (verdict.trip && verdict.reason) {
      pausedCampaignIds.add(campaignId)
      await pauseCampaignForSafety(campaignId, { ...verdict, trip: true, reason: verdict.reason })
    }
  }

  const { data: contentRows } = campaignIds.length
    ? await supabase
        .from("email_campaign_content")
        .select("campaign_id,subject,html")
        .in("campaign_id", campaignIds)
    : { data: [] }
  const contentMap = new Map(contentRows?.map((row) => [row.campaign_id, row]) ?? [])
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

  async function sendWithBackoff(
    contact: string,
    subject: string,
    html: string,
    fromEmail?: string,
    fromName?: string,
    replyTo?: string,
    tags?: Record<string, string | null | undefined>,
    unsubscribeUrl?: string,
    attempt = 0,
  ): Promise<string> {
    try {
      return await sendEmailCampaign({
        to: contact,
        subject,
        html,
        fromEmail,
        fromName,
        replyTo,
        tags,
        unsubscribeUrl,
      })
    } catch (err: any) {
      if (isSesRateLimitError(err) && attempt < EMAIL_RATE_MAX_RETRY) {
        const delay = EMAIL_RETRY_BACKOFF_MS * Math.max(1, attempt + 1)
        await sleep(delay)
        return sendWithBackoff(
          contact,
          subject,
          html,
          fromEmail,
          fromName,
          replyTo,
          tags,
          unsubscribeUrl,
          attempt + 1,
        )
      }
      throw err
    }
  }

  for (const rawJob of jobs) {
    const job = rawJob as any
    if (job.campaign_id && pausedCampaignIds.has(job.campaign_id)) {
      continue
    }
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
      const buyer = {
        fname: contact.firstName,
        lname: contact.lastName,
        phone: contact.phone,
        email: contact.email,
      }
      const content = job.campaign_id ? contentMap.get(job.campaign_id) : undefined
      const rawSubject = content?.subject ?? payload.subject ?? ""
      const rawHtml = content?.html ?? payload.html ?? ""
      const senderContext = campaignMergeContextMap.get(job.campaign_id || payload.campaignId || "")
      const subject = renderTemplate(rawSubject, buyer, senderContext)
      let html = renderTemplate(rawHtml, buyer, senderContext)
      if (!emailShortlinksDisabled()) {
        try {
          const { replaceUrlsWithShortLinks } = await import("./shortlink-service")
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
      const providerId = await sendWithBackoff(
        contact.email,
        subject,
        html,
        payload.fromEmail,
        payload.fromName,
        payload.replyTo,
        tags,
        unsubscribeUrl,
      )
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
      if (job.campaign_id && !pausedCampaignIds.has(job.campaign_id)) {
        await refreshCampaignStatus(job.campaign_id)
      }
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
      if (job.campaign_id && !pausedCampaignIds.has(job.campaign_id)) {
        await refreshCampaignStatus(job.campaign_id)
      }
    }
  }

  return { processed: jobs.length, sent }
}
