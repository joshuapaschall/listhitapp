import { apiError } from "@/lib/api-error"
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
import { applyShortLinkPreview } from "@/lib/shortlink-preview"
import { fetchAllRows } from "@/lib/supabase-fetch-all"
import { resolveAudienceIds } from "@/lib/campaigns/resolve-audience-ids"
import { formatPhoneE164, normalizeEmail } from "@/lib/dedup-utils"
import * as smsCampaignSender from "@/services/sms-campaign-sender"
import { requireOrgContext, resolveOrgIdForUser } from "@/lib/auth/org-context"
import { resolveCampaignSender, SenderNotVerifiedError } from "@/lib/email-sender-resolver"
import { isValidEmailSyntax } from "@/lib/email/validate-syntax"
import { insertNotification } from "@/lib/notifications"
import { applyChannelEligibility } from "@/lib/segments/eligibility"
import { resolveSegment } from "@/lib/segments/resolver"
import type { SegmentDefinition } from "@/lib/segments/types"

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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const cronSecret = process.env.CRON_SECRET
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_SUPABASE_URL env var is required" },
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

  const body = await request.json()
  const { campaignId, dryRun: dryRunFromBody } = body
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
  let orgId: string | null = null
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
    orgId = await resolveOrgIdForUser(userId)
    if (!orgId) {
      return NextResponse.json({ error: "Organization context required" }, { status: 403 })
    }
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
  if (authSource === "user_jwt" && orgId) {
    campaignQuery = campaignQuery.eq("org_id", orgId)
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
    const shortenOn = campaign.shorten_links !== false
    const guardDomain = process.env.SHORT_LINK_DEFAULT_DOMAIN || ""
    const guardBody =
      shortenOn && guardDomain
        ? applyShortLinkPreview(campaign.message || "", guardDomain).effective
        : campaign.message || ""
    const seg = calculateSmsSegments(guardBody)
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
  let buyerIds: string[] = Array.isArray(campaign.buyer_ids)
    ? campaign.buyer_ids
    : campaign.buyer_ids
      ? JSON.parse(campaign.buyer_ids)
      : []

  // Dynamic resolve-at-dispatch: if this campaign carries a segment/definition,
  // re-resolve the audience fresh now so opt-outs since compose are honored. The
  // engine's final eligibility gate (3c-i shared predicate) re-checks suppression.
  const hasDynamicAudience = !!campaign.segment_id || !!campaign.audience_definition
  if (hasDynamicAudience) {
    try {
      let definition: SegmentDefinition | null = null
      if (campaign.segment_id) {
        const { data: seg } = await supabase
          .from("segments")
          .select("definition, deleted_at")
          .eq("id", campaign.segment_id)
          .eq("org_id", campaign.org_id) // tenant scope — never another org's segment
          .maybeSingle()
        if (seg && !seg.deleted_at) definition = seg.definition as SegmentDefinition
      } else if (campaign.audience_definition) {
        definition = campaign.audience_definition as SegmentDefinition
      }

      if (definition) {
        const resolved = await resolveSegment(definition, {
          supabase,
          orgId: campaign.org_id, // resolution is scoped to THIS campaign's org
          channel: campaign.channel,
          contextCampaignId: campaign.id,
        })
        const resolvedIds = Array.from(resolved)

        // Drift guard: only ever fires on unexpected EXPANSION. Shrinkage is safe.
        const preview =
          typeof campaign.audience_preview_count === "number" && campaign.audience_preview_count > 0
            ? campaign.audience_preview_count
            : null
        const ceiling = preview === null ? null : Math.max(preview * 2, preview + 250)
        if (ceiling !== null && resolvedIds.length > ceiling) {
          await supabase
            .from("campaigns")
            .update({
              status: "error",
              error: `audience_drift_guard: resolved ${resolvedIds.length} exceeds ceiling ${ceiling} (preview ${preview})`,
            })
            .eq("id", campaignId)
          return NextResponse.json(
            { ok: false, paused: true, reason: "audience_drift_guard", resolved: resolvedIds.length, ceiling },
            { status: 200 },
          )
        }

        // Fresh resolution becomes the recipient source. A successful empty set is
        // respected — those people no longer qualify / opted out — so we send to nobody.
        buyerIds = resolvedIds
      }
      // definition null (e.g. saved segment deleted) → fall through to the stored snapshot.
    } catch (e) {
      // Throw only → keep the stored buyer_ids snapshot. Never fail the dispatch,
      // never send to empty by accident, falling back to snapshot buyer_ids.
      console.error("dynamic audience resolve failed; falling back to snapshot buyer_ids", e)
    }
  }

  // Resolve the audience through the SAME function the preview count uses, so the
  // shown count and the sent count are guaranteed to agree.
  let finalIds: string[]
  try {
    finalIds = await resolveAudienceIds({
      supabase,
      orgId: campaign.org_id,
      channel: campaign.channel,
      buyerIds,
      groupIds,
    })
  } catch (err) {
    console.error("Error resolving campaign audience", err)
    return new Response(JSON.stringify({ error: "Failed to fetch recipients" }), { status: 500 })
  }

  // Expected-count guard — mirror of audience_drift_guard, only trips on expansion
  // beyond the count the operator confirmed. Optional, so the cron path (which posts
  // only { campaignId }) is unaffected. Shrinkage is always safe.
  const expectedCount = typeof body?.expectedCount === "number" ? body.expectedCount : null
  if (expectedCount !== null && expectedCount > 0) {
    const ceiling = Math.max(Math.ceil(expectedCount * 1.1), expectedCount + 50)
    if (finalIds.length > ceiling) {
      await supabase
        .from("campaigns")
        .update({
          status: "error",
          error: `audience_count_mismatch: resolved ${finalIds.length} exceeds ceiling ${ceiling} (expected ${expectedCount})`,
        })
        .eq("id", campaignId)
      return NextResponse.json(
        { ok: false, paused: true, reason: "audience_count_mismatch", resolved: finalIds.length, expected: expectedCount },
        { status: 200 },
      )
    }
  }

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
      .map((id) => ({ campaign_id: campaignId, buyer_id: id, status: "pending", org_id: campaign.org_id }))

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
      const rows = finalIds.map((id) => ({ campaign_id: campaignId, buyer_id: id, org_id: campaign.org_id }))
      const { error: insErr } = await supabase
        .from("campaign_recipients")
        .insert(rows)
      if (insErr) {
        console.error("Error inserting recipients", insErr)
        return new Response(JSON.stringify({ error: "Failed to fetch recipients" }), { status: 500 })
      }
    }
  }

  let recipients: any[]
  try {
    recipients = await fetchAllRows<any>(
      () =>
        applyChannelEligibility(
          supabase
            .from("campaign_recipients")
            .select(
              "id,buyer_id,status,buyers!inner(id,fname,lname,email,phone,phone2,phone3,can_receive_sms,can_receive_email,deleted_at)"
            )
            .eq("campaign_id", campaignId),
          campaign.channel,
          "buyers.",
        ),
      "id",
    )
  } catch (recErr) {
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

  if (campaign.channel === "sms" && !dryRun && campaign.shorten_links !== false) {
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
    let emailContacts: EmailContactPayload[] = (recipients || [])
      .map((row: any) => {
        const buyer: any = (row as any).buyers || {}
        if (!buyer.email || !buyer.can_receive_email || buyer.deleted_at) {
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

    const seenEmails = new Set<string>()
    const removedInvalid: string[] = []
    let removedDuplicates = 0
    const cleanedEmailContacts: EmailContactPayload[] = []

    for (const contact of emailContacts) {
      const normalizedEmail = normalizeEmail(contact.email)
      if (!normalizedEmail || !isValidEmailSyntax(normalizedEmail)) {
        if (contact.recipientId) removedInvalid.push(contact.recipientId)
        continue
      }

      if (seenEmails.has(normalizedEmail)) {
        removedDuplicates += 1
        continue
      }

      seenEmails.add(normalizedEmail)
      cleanedEmailContacts.push(contact)
    }

    emailContacts = cleanedEmailContacts

    if (removedInvalid.length > 0) {
      await supabase
        .from("campaign_recipients")
        .update({ status: "error", error: "invalid_email_syntax" })
        .in("id", removedInvalid)
    }

    if (removedInvalid.length > 0 || removedDuplicates > 0) {
      console.warn("Recipients filtered before email send", {
        campaignId: campaign.id,
        invalid: removedInvalid.length,
        duplicates: removedDuplicates,
      })
      await insertNotification({
        type: "email_hygiene",
        title: "Recipients filtered before send",
        body: `${removedInvalid.length} invalid, ${removedDuplicates} duplicate addresses skipped.`,
        metadata: {
          campaignId: campaign.id,
          invalidSample: removedInvalid.slice(0, 10),
        },
      })
    }

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
        // Deliberate, safe user-facing message for this known error type.
        return apiError(err, 422, err.message)
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

    await supabase
      .from("campaigns")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", campaignId)
      .is("sent_at", null)

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

      let queuedRecipients: Array<{
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
        if (buyer.deleted_at || !buyer.can_receive_sms) {
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

      // De-duplicate across campaign recipients by to_number, keeping the first occurrence.
      const queuedRecipientCountBeforeDedup = queuedRecipients.length
      const seenSmsNumbers = new Set<string>()
      queuedRecipients = queuedRecipients.filter((recipient) => {
        const normalizedNumber = formatPhoneE164(recipient.toNumber)
        if (!normalizedNumber || seenSmsNumbers.has(normalizedNumber)) {
          return false
        }
        seenSmsNumbers.add(normalizedNumber)
        recipient.toNumber = normalizedNumber
        return true
      })
      const duplicateCount = queuedRecipientCountBeforeDedup - queuedRecipients.length
      if (duplicateCount > 0) {
        console.log("Removed duplicate SMS recipients before queueing", {
          campaignId,
          duplicateCount,
        })
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

      await supabase
        .from("campaigns")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", campaignId)
        .is("sent_at", null)

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
