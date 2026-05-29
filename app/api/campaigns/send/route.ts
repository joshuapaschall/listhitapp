import { NextRequest, NextResponse } from "next/server"
import {
  processEmailQueue,
  queueEmailCampaign,
  type EmailContactPayload,
} from "@/services/campaign-sender"
import { createShortLinksBulk } from "@/services/shortlink-service"
import { assertServer } from "@/utils/assert-server"
import { getCronRequestToken, isJwtLike } from "@/lib/cron-auth"
import { linkifyHtml } from "@/lib/email/linkify-html"
import { calculateSmsSegments } from "@/lib/sms-utils"
import { formatPhoneE164 } from "@/lib/dedup-utils"
import * as smsCampaignSender from "@/services/sms-campaign-sender"
import { requireOrgContext, resolveOrgIdForUser } from "@/lib/auth/org-context"
import { resolveCampaignSender, SenderNotVerifiedError } from "@/lib/email-sender-resolver"

assertServer()

export const maxDuration = 300

const resolveTimezone = (tz?: string | null) =>
  tz && tz.trim() ? tz : "America/New_York"
const getNowInTimezone = (tz: string) => {
  try {
    return new Date(new Date().toLocaleString("en-US", { timeZone: tz }))
  } catch {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }))
  }
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL
  const cronSecret = process.env.CRON_SECRET
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    return NextResponse.json(
      { error: "SUPABASE_URL env var is required" },
      { status: 500 },
    )
  }
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY env var is required" },
      { status: 500 },
    )
  }
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET env var is required" },
      { status: 500 },
    )
  }

  const { supabaseAdmin } = await import("@/lib/supabase")
  const supabase = supabaseAdmin

  const { campaignId, dryRun: dryRunFromBody } = await request.json()
  const dryRun = (dryRunFromBody === true) || process.env.LISTHIT_DRY_RUN === "1"

  if (!campaignId) {
    return NextResponse.json({ error: "campaignId required" }, { status: 400 })
  }

  const requestToken = getCronRequestToken(request)
  if (!requestToken) {
    console.error("campaigns/send unauthorized: missing token")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let userId: string | null = null
  let authSource: "cron_secret" | "service_role" | "user_jwt"
  if (requestToken === cronSecret) {
    authSource = "cron_secret"
  } else if (requestToken === serviceRoleKey) {
    authSource = "service_role"
  } else if (isJwtLike(requestToken)) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(requestToken)
    if (userError || !user) {
      console.error("campaigns/send unauthorized: invalid user token", userError)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    userId = user.id
    authSource = "user_jwt"
  } else {
    console.error("campaigns/send unauthorized: invalid token")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  console.log("campaigns/send auth ok", { source: authSource, campaignId, dryRun })

  let campaignQuery = supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
  if (authSource === "user_jwt" && userId) {
    campaignQuery = campaignQuery.eq("user_id", userId)
  }
  const { data: campaign, error } = await campaignQuery.maybeSingle()

  if (error || !campaign) {
    console.error("Campaign lookup failed", error)
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
  }

  if (!campaign.message || campaign.message.trim().length === 0) {
    return NextResponse.json(
      { error: "Campaign has no content. Add a message before sending." },
      { status: 400 },
    )
  }

  const timezone = resolveTimezone(campaign.timezone)
  const zonedNow = getNowInTimezone(timezone)
  if (campaign.weekday_only && (zonedNow.getDay() === 0 || zonedNow.getDay() === 6)) {
    return new Response(
      JSON.stringify({ error: "Outside allowed send window" }),
      { status: 400 },
    )
  }
  if (campaign.run_from && campaign.run_until) {
    const [fh, fm] = campaign.run_from.split(":").map(Number)
    const [th, tm] = campaign.run_until.split(":").map(Number)
    const nowMin = zonedNow.getHours() * 60 + zonedNow.getMinutes()
    const fromMin = fh * 60 + fm
    const toMin = th * 60 + tm
    if (nowMin < fromMin || nowMin > toMin) {
      return new Response(
        JSON.stringify({ error: "Outside allowed send window" }),
        { status: 400 },
      )
    }
  }
  if (campaign.channel === "sms") {
    const seg = calculateSmsSegments(campaign.message || "")
    if (seg.segments > 10) {
      return new Response(
        JSON.stringify({ error: `Message is ${seg.segments} segments. Telnyx hard-caps at 10. Shorten and re-send.` }),
        { status: 400 },
      )
    }
  }

  const groupIds: string[] = Array.isArray(campaign.group_ids)
    ? campaign.group_ids
    : campaign.group_ids
      ? JSON.parse(campaign.group_ids)
      : []
  const buyerIds: string[] = Array.isArray(campaign.buyer_ids)
    ? campaign.buyer_ids
    : campaign.buyer_ids
      ? JSON.parse(campaign.buyer_ids)
      : []

  const idSet = new Set<string>(buyerIds)
  if (groupIds.length) {
    const { data: groupRows, error: groupErr } = await supabase
      .from("buyer_groups")
      .select("buyer_id, buyers!inner(id)")
      .in("group_id", groupIds)
      .eq("buyers.sendfox_hidden", false)
      .eq("buyers.sendfox_suppressed", false)
    if (groupErr) {
      console.error("Error fetching group buyers", groupErr)
      return new Response(JSON.stringify({ error: "Failed to fetch recipients" }), { status: 500 })
    }
    for (const row of groupRows || []) {
      idSet.add(row.buyer_id)
    }
  }

  let finalIds = Array.from(idSet)
  let allowedQuery = supabase
    .from("buyers")
    .select("id")
    .in("id", finalIds)
    .eq("sendfox_hidden", false)
    .eq("sendfox_suppressed", false)
  if (campaign.channel === "email") {
    allowedQuery = allowedQuery.eq("can_receive_email", true)
  }
  const { data: allowed, error: allowErr } = await allowedQuery
  if (allowErr) {
    console.error("Error filtering recipients", allowErr)
    return new Response(JSON.stringify({ error: "Failed to fetch recipients" }), { status: 500 })
  }
  finalIds = (allowed || []).map((r: any) => r.id)

  if (campaign.channel === "sms") {
    const { data: existingRows, error: existingErr } = await supabase
      .from("campaign_recipients")
      .select("buyer_id")
      .eq("campaign_id", campaignId)

    if (existingErr) {
      console.error("Error fetching existing recipients", existingErr)
      return new Response(JSON.stringify({ error: "Failed to fetch recipients" }), { status: 500 })
    }

    const existingBuyerIds = new Set((existingRows || []).map((row: any) => row.buyer_id))
    const rows = finalIds
      .filter((id) => !existingBuyerIds.has(id))
      .map((id) => ({ campaign_id: campaignId, buyer_id: id, status: "pending" }))

    if (rows.length) {
      const { error: insErr } = await supabase
        .from("campaign_recipients")
        .insert(rows)
      if (insErr) {
        console.error("Error inserting recipients", insErr)
        return new Response(JSON.stringify({ error: "Failed to fetch recipients" }), { status: 500 })
      }
    }
  } else {
    await supabase.from("campaign_recipients").delete().eq("campaign_id", campaignId)
    if (finalIds.length) {
      const rows = finalIds.map((id) => ({ campaign_id: campaignId, buyer_id: id }))
      const { error: insErr } = await supabase
        .from("campaign_recipients")
        .insert(rows)
      if (insErr) {
        console.error("Error inserting recipients", insErr)
        return new Response(JSON.stringify({ error: "Failed to fetch recipients" }), { status: 500 })
      }
    }
  }

  let recipientsQuery = supabase
    .from("campaign_recipients")
    .select(
      "id,buyer_id,status,buyers!inner(id,fname,lname,email,phone,phone2,phone3,can_receive_sms,can_receive_email,sendfox_hidden)"
    )
    .eq("campaign_id", campaignId)
    .eq("buyers.sendfox_hidden", false)
    .eq("buyers.sendfox_suppressed", false)
  if (campaign.channel === "email") {
    recipientsQuery = recipientsQuery.eq("buyers.can_receive_email", true)
  }
  const { data: recipients, error: recErr } = await recipientsQuery

  if (recErr) {
    console.error("Error fetching recipients", recErr)
    return new Response(JSON.stringify({ error: "Failed to fetch recipients" }), { status: 500 })
  }

  // ============================================================
  // A.5.1 — Pre-generate per-recipient unique short links for SMS.
  //
  // For each (recipient × URL) pair in the campaign message, create one unique
  // short link via the native short-link service. This enables per-recipient
  // click attribution: the redirect handler calls record_short_link_click(),
  // which cascades clicked_at onto the linked campaign_recipients row.
  //
  // Multi-URL support is native — multiple URLs per message produce multiple
  // rows per recipient, all attributed via campaign_recipient_id FK.
  //
  // Map shape: campaign_recipient.id → Array<{ originalUrl, shortUrl, slug }>
  // ============================================================
  type RecipientLinkEntry = { originalUrl: string; shortUrl: string; slug: string }
  const shortLinksByRecipient = new Map<string, RecipientLinkEntry[]>()

  if (campaign.channel === "sms" && !dryRun) {
    const urlRegex = /(https?:\/\/[^\s"'>]+)/g
    const messageText: string = campaign.message || ""
    const messageUrls = Array.from(new Set(messageText.match(urlRegex) || []))

    if (messageUrls.length > 0 && (recipients?.length || 0) > 0) {
      type PairMeta = { recipientRowId: string; buyerId: string; url: string }
      const pairMetadata: PairMeta[] = []
      const bulkInputs: Array<{
        targetUrl: string
        campaignId: string
        campaignRecipientId: string
        createdBy?: string | null
        tags: string[]
        expiresAt: string
      }> = []

      // 90-day TTL on campaign links
      const expiresAtIso = new Date(
        Date.now() + 90 * 24 * 60 * 60 * 1000,
      ).toISOString()

      for (const r of recipients || []) {
        for (const url of messageUrls) {
          pairMetadata.push({
            recipientRowId: r.id,
            buyerId: r.buyer_id,
            url,
          })
          bulkInputs.push({
            targetUrl: url,
            campaignId,
            campaignRecipientId: r.id,
            createdBy: campaign.user_id ?? campaign.created_by ?? null,
            tags: [`campaign:${campaignId}`, `recipient:${r.buyer_id}`],
            expiresAt: expiresAtIso,
          })
        }
      }

      try {
        const results = await createShortLinksBulk(bulkInputs)
        for (let i = 0; i < results.length; i++) {
          const result = results[i]
          const meta = pairMetadata[i]
          if (!result) {
            console.error(
              "[send] Short link creation failed for recipient",
              meta.recipientRowId,
              "url",
              meta.url,
            )
            continue
          }
          if (!shortLinksByRecipient.has(meta.recipientRowId)) {
            shortLinksByRecipient.set(meta.recipientRowId, [])
          }
          shortLinksByRecipient.get(meta.recipientRowId)!.push({
            originalUrl: meta.url,
            shortUrl: result.shortUrl,
            slug: result.slug,
          })
        }
      } catch (err) {
        // If bulk creation entirely fails, log and continue WITHOUT short links.
        // The campaign still sends with raw URLs — click tracking is lost for this
        // blast but message delivery is not blocked.
        console.error(
          "[send] Short link bulk creation aborted; falling back to raw URLs:",
          err,
        )
      }
    }
  }

  if (campaign.channel === "email") {
    const emailContacts: EmailContactPayload[] = (recipients || [])
      .map((row: any) => {
        const buyer: any = (row as any).buyers || {}
        if (!buyer.email || !buyer.can_receive_email || buyer.sendfox_hidden) {
          return null
        }
      return {
        email: buyer.email,
        firstName: buyer.fname,
        lastName: buyer.lname,
        phone: buyer.phone,
        recipientId: row.id,
        buyerId: row.buyer_id,
      }
      })
      .filter(Boolean) as EmailContactPayload[]

    if (!emailContacts.length) {
      return new Response(
        JSON.stringify({ error: "no recipients" }),
        { status: 400 },
      )
    }

    let sender
    try {
      const { orgId: sessionOrgId } = await requireOrgContext()
      const orgId = sessionOrgId ?? await resolveOrgIdForUser(campaign.user_id)
      sender = await resolveCampaignSender(orgId, {
        fromEmail: campaign.from_email,
        fromName: campaign.from_name,
      })
    } catch (err: any) {
      if (err instanceof SenderNotVerifiedError) {
        return new Response(
          JSON.stringify({ error: err.message }),
          { status: 422 },
        )
      }
      console.error("Sender resolution failed", err)
      return new Response(
        JSON.stringify({ error: "Failed to resolve email sender" }),
        { status: 500 },
      )
    }

    await supabase
      .from("campaign_recipients")
      .update({ status: "pending", error: null })
      .in(
        "id",
        emailContacts
          .map((c) => c.recipientId)
          .filter((v): v is string => Boolean(v)),
      )

    try {
      const html = linkifyHtml(campaign.message || "")
      await queueEmailCampaign(
        {
          campaignId: campaign.id,
          subject: campaign.subject || "",
          html,
          contacts: emailContacts,
          fromEmail: sender.fromEmail,
          fromName: sender.fromName,
          replyTo: sender.replyTo,
        },
        {
          scheduledFor: campaign.scheduled_at || undefined,
          createdBy: userId || campaign.user_id || undefined,
        },
      )
    } catch (err: any) {
      console.error("Queue insertion failed", err)
      const isMissingCampaign = err?.code === "23503"
      return new Response(
        JSON.stringify({
          error: "Failed to queue email campaign",
          details: err?.message || String(err),
          hint: isMissingCampaign
            ? "Campaign definition record is missing; ensure campaign_id is valid before queuing."
            : "Queue insertion failed; check campaign definition and queue payload.",
        }),
        { status: 500 },
      )
    }

    const dispatched = await processEmailQueue(3)
    return new Response(
      JSON.stringify({ ok: true, queued: emailContacts.length, dispatched }),
      { status: 200 },
    )
  }

  if (campaign.channel === "sms") {
    try {
      if (!recipients.length) {
        return new Response(
          JSON.stringify({ error: "no recipients" }),
          { status: 400 },
        )
      }

      let mediaUrls: string[] | undefined
      if (campaign.media_url) {
        try {
          const parsed = JSON.parse(campaign.media_url)
          mediaUrls = Array.isArray(parsed) ? parsed : [campaign.media_url]
        } catch {
          mediaUrls = [campaign.media_url]
        }
      }

      const queuedRecipients: Array<{
        recipientId: string
        buyerId: string
        toNumber: string
        body: string
      }> = []

      for (const row of recipients || []) {
        if (["sent", "delivered"].includes((row.status || "").toLowerCase())) {
          continue
        }

        const buyer: any = (row as any).buyers || {}
        if (buyer.sendfox_hidden || !buyer.can_receive_sms) {
          continue
        }

        const numbers: string[] = []
        if (buyer.phone) numbers.push(buyer.phone)
        if (campaign.send_to_all_numbers) {
          if (buyer.phone2) numbers.push(buyer.phone2)
          if (buyer.phone3) numbers.push(buyer.phone3)
        }

        const uniqueNumbers = Array.from(
          new Set(
            numbers
              .map((number) => formatPhoneE164(number))
              .filter((number): number is string => Boolean(number)),
          ),
        )
        if (!uniqueNumbers.length) {
          continue
        }

        let smsBody = campaign.message || ""
        let shortKey: string | null = null
        const recipientLinks = shortLinksByRecipient.get(row.id)
        if (recipientLinks && recipientLinks.length > 0) {
          for (const link of recipientLinks) {
            smsBody = smsBody.split(link.originalUrl).join(link.shortUrl)
          }
          shortKey = recipientLinks[0].slug
        }

        if (shortKey) {
          await supabase
            .from("campaign_recipients")
            .update({ short_url_key: shortKey })
            .eq("id", row.id)
        }

        for (const toNumber of uniqueNumbers) {
          queuedRecipients.push({
            recipientId: row.id,
            buyerId: row.buyer_id,
            toNumber,
            body: smsBody,
          })
        }
      }

      if (!queuedRecipients.length) {
        return new Response(
          JSON.stringify({ error: "no recipients" }),
          { status: 400 },
        )
      }

      await smsCampaignSender.queueSmsCampaign({
        campaignId,
        mediaUrls,
        recipients: queuedRecipients,
      })

      const queuedRecipientIds = Array.from(new Set(queuedRecipients.map((recipient) => recipient.recipientId)))
      await supabase
        .from("campaign_recipients")
        .update({ status: "pending", error: null })
        .in("id", queuedRecipientIds)

      const { error: statusErr } = await supabase
        .from("campaigns")
        .update({ status: "processing" })
        .eq("id", campaignId)

      if (statusErr) {
        console.error("Error updating campaign status", statusErr)
      }

      const dispatched = await smsCampaignSender.processSmsQueue(5)
      return new Response(
        JSON.stringify({ ok: true, queued: queuedRecipients.length, dispatched }),
        { status: 200 },
      )
    } catch (e: any) {
      console.error("campaigns/send failed", { message: e?.message, stack: e?.stack })
      return new Response(
        JSON.stringify({ error: e?.message || "send failed" }),
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ error: "Unsupported campaign channel" }, { status: 400 })
}
