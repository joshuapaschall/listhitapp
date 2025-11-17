import { NextRequest, NextResponse } from "next/server"
import { sendCampaignSMS } from "@/services/campaign-sender.server"
import { sendEmailCampaign } from "@/services/campaign-sender"
import { replaceUrlsWithShortLinks } from "@/services/shortio-service"
import { renderTemplate } from "@/lib/utils"
import { assertServer } from "@/utils/assert-server"

assertServer()

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const expectedToken = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing auth header" }, { status: 401 })
  }

  const token = authHeader.split(" ")[1]
  const { supabaseAdmin } = await import("@/lib/supabase")
  const supabase = supabaseAdmin

  const { campaignId } = await request.json()

  if (!campaignId) {
    return new Response(JSON.stringify({ error: "campaignId required" }), { status: 400 })
  }

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle()

  if (error || !campaign) {
    console.error("Campaign lookup failed", error)
    return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404 })
  }

  const estNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
  )
  if (
    campaign.weekday_only && (estNow.getDay() === 0 || estNow.getDay() === 6)
  ) {
    return new Response(
      JSON.stringify({ error: "Outside allowed send window" }),
      { status: 400 },
    )
  }
  if (campaign.run_from && campaign.run_until) {
    const [fh, fm] = campaign.run_from.split(":").map(Number)
    const [th, tm] = campaign.run_until.split(":").map(Number)
    const nowMin = estNow.getHours() * 60 + estNow.getMinutes()
    const fromMin = fh * 60 + fm
    const toMin = th * 60 + tm
    if (nowMin < fromMin || nowMin > toMin) {
      return new Response(
        JSON.stringify({ error: "Outside allowed send window" }),
        { status: 400 },
      )
    }
  }

  let userId: string | null = null
  if (token !== expectedToken) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    userId = user.id
    if (userId !== campaign.user_id) {
      console.error("User", userId, "not authorized for campaign", campaignId)
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })
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
    if (groupErr) {
      console.error("Error fetching group buyers", groupErr)
      return new Response(JSON.stringify({ error: "Failed to fetch recipients" }), { status: 500 })
    }
    for (const row of groupRows || []) {
      idSet.add(row.buyer_id)
    }
  }

  let finalIds = Array.from(idSet)
  const { data: allowed, error: allowErr } = await supabase
    .from("buyers")
    .select("id")
    .in("id", finalIds)
    .eq("sendfox_hidden", false)
  if (allowErr) {
    console.error("Error filtering recipients", allowErr)
    return new Response(JSON.stringify({ error: "Failed to fetch recipients" }), { status: 500 })
  }
  finalIds = (allowed || []).map((r: any) => r.id)

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

  const { data: recipients, error: recErr } = await supabase
    .from("campaign_recipients")
    .select(
      "id,buyer_id,status,buyers!inner(id,fname,lname,email,phone,phone2,phone3,can_receive_sms,can_receive_email,sendfox_hidden)"
    )
    .eq("campaign_id", campaignId)
    .eq("buyers.sendfox_hidden", false)

  if (recErr) {
    console.error("Error fetching recipients", recErr)
    return new Response(JSON.stringify({ error: "Failed to fetch recipients" }), { status: 500 })
  }

  async function handleRecipient(row: any) {
    const buyer: any = (row as any).buyers || {}
    if (buyer.sendfox_hidden) {
      return false
    }
    let providerId: string | null = null
    let fromNumber: string | null = null
    let status = "sent"
    let errorText: string | null = null
    let shortUrlKey: string | null = null

    try {
      if (campaign.channel === "sms") {
        const numbers: string[] = []
        if (buyer.phone && buyer.can_receive_sms) numbers.push(buyer.phone)
        if (campaign.send_to_all_numbers) {
          if (buyer.phone2) numbers.push(buyer.phone2)
          if (buyer.phone3) numbers.push(buyer.phone3)
        }
        if (!numbers.length) {
          throw new Error("Buyer cannot receive SMS")
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
        let smsBody = renderTemplate(campaign.message, buyer)
        let shortKey: string | null = null
        try {
          const replaced = await replaceUrlsWithShortLinks(smsBody)
          smsBody = replaced.html
          shortKey = replaced.key
        } catch (err) {
          console.error("Short.io replacement failed", err)
        }
        if (smsBody.length > 160) smsBody = smsBody.slice(0, 160)
        const results = await sendCampaignSMS({
          buyerId: row.buyer_id,
          to: numbers,
          body: smsBody,
          mediaUrls,
          campaignId,
        })

        const { data: senderRow } = await supabase
          .from("buyer_sms_senders")
          .select("from_number")
          .eq("buyer_id", row.buyer_id)
          .maybeSingle()
        fromNumber = senderRow?.from_number || results[0]?.from || null

        providerId = results[0]?.sid || null

        // insert additional recipient rows for extra numbers
        if (results.length > 1) {
          const extraRows = results.slice(1).map((r) => ({
            campaign_id: campaignId,
            buyer_id: row.buyer_id,
            sent_at: new Date().toISOString(),
            provider_id: r.sid,
            from_number: r.from,
            status: "sent",
            error: null,
          }))
          const { error: insertErr } = await supabase
            .from("campaign_recipients")
            .insert(extraRows)
          if (insertErr) {
            console.error("Error inserting extra recipients", insertErr)
          }
        }
        shortUrlKey = shortKey
      } else {
        if (!buyer.email || !buyer.can_receive_email) {
          throw new Error("Buyer cannot receive email")
        }
        const subject = renderTemplate(campaign.subject || "", buyer)
        let html = renderTemplate(campaign.message, buyer)
        let shortKey: string | null = null
        try {
          const replaced = await replaceUrlsWithShortLinks(html)
          html = replaced.html
          shortKey = replaced.key
        } catch (err) {
          console.error("Short.io replacement failed", err)
        }
        providerId = await sendEmailCampaign({
          to: buyer.email,
          subject,
          html,
        })
        shortUrlKey = shortKey
      }
    } catch (err: any) {
      status = "error"
      errorText = err.message || String(err)
    }

    await supabase
      .from("campaign_recipients")
      .update({
        sent_at: new Date().toISOString(),
        provider_id: providerId,
        from_number: fromNumber,
        short_url_key: shortUrlKey,
        status,
        error: errorText,
      })
      .eq("id", row.id)

    return status === "sent"
  }

  try {
    if (!recipients.length) {
      return new Response(
        JSON.stringify({ error: "no recipients" }),
        { status: 400 },
      )
    }

    const results = await Promise.allSettled(
      (recipients || []).map((r) => handleRecipient(r)),
    )

    const allSuccess = results.every(
      (res) => res.status === "fulfilled" && res.value === true,
    )

    const { error: statusErr } = await supabase
      .from("campaigns")
      .update({ status: allSuccess ? "sent" : "error" })
      .eq("id", campaignId)

    if (statusErr) {
      console.error("Error updating campaign status", statusErr)
    }

    return new Response(
      JSON.stringify({ ok: true, sent: recipients.length }),
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
