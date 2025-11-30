import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { loadSendfoxRouteContext } from "../_auth"
import { upsertContact } from "@/services/sendfox-service"
import { withSendfoxAuth } from "@/services/sendfox-auth"
import { sendEmailCampaign } from "@/services/campaign-sender"

const supabase = supabaseAdmin

async function logConsent(
  email: string,
  listIds: number[],
  opts: { buyerId?: string | null; doubleOptIn?: boolean; token?: string; consented?: boolean; request: NextRequest },
) {
  if (!supabase || !listIds.length) return
  const now = new Date().toISOString()
  const rows = listIds.map((listId) => ({
    buyer_id: opts.buyerId || null,
    email,
    list_id: listId,
    double_opt_in: Boolean(opts.doubleOptIn),
    consent_token: opts.token || null,
    consented_at: opts.consented ? now : null,
    confirmed_at: opts.consented ? now : null,
    ip_address: opts.request.headers.get("x-forwarded-for"),
    user_agent: opts.request.headers.get("user-agent"),
  }))
  await supabase
    .from("buyer_list_consent")
    .upsert(rows, { onConflict: "email_norm,list_id" })
}

async function processContact(req: NextRequest, body: any) {
  try {
    const { authContext, response } = await loadSendfoxRouteContext()
    if (response) return response
    if (!authContext) {
      return new Response(JSON.stringify({ connected: false, error: "SendFox not connected" }), {
        status: 200,
      })
    }
    if (!supabase) {
      return new Response(JSON.stringify({ error: "Supabase client not configured" }), { status: 500 })
    }

    const email = (body?.email || "").trim().toLowerCase()
    if (!email) {
      return new Response(JSON.stringify({ error: "email required" }), { status: 400 })
    }

    const token = body?.token || req.nextUrl.searchParams.get("token")
    const doubleOptIn = Boolean(body?.double_opt_in)
    let lists = Array.isArray(body?.lists) ? body.lists : []
    if ((!lists || lists.length === 0) && process.env.SENDFOX_DEFAULT_LIST_ID) {
      lists = [Number(process.env.SENDFOX_DEFAULT_LIST_ID)]
    }
    if (!Array.isArray(lists) || lists.some((n: any) => !Number.isInteger(Number(n)))) {
      return new Response(JSON.stringify({ error: "lists must be array of integers" }), { status: 400 })
    }
    const listIds = lists.map((n: any) => Number(n))

    const buyerId = supabase
      ? (
          await supabase
            .from("buyers")
            .select("id")
            .eq("email_norm", email)
            .maybeSingle()
        ).data?.id || null
      : null

    if (doubleOptIn && token) {
      const { data: pending, error: pendingErr } = await supabase
        .from("buyer_list_consent")
        .select("list_id")
        .eq("consent_token", token)
        .eq("email_norm", email)
        .is("confirmed_at", null)

      if (pendingErr) {
        return new Response(JSON.stringify({ error: pendingErr.message }), { status: 500 })
      }
      if (!pending || pending.length === 0) {
        return new Response(JSON.stringify({ error: "invalid or expired token" }), { status: 400 })
      }
      const confirmedLists = pending.map((p) => Number(p.list_id)).filter((n) => !Number.isNaN(n))
      const contact = await withSendfoxAuth(authContext, async () =>
        upsertContact(
          email,
          body?.first_name,
          body?.last_name,
          confirmedLists,
          body?.tags,
          body?.ip_address,
        ),
      )

      const now = new Date().toISOString()
      if (supabase) {
        await supabase
          .from("buyer_list_consent")
          .update({ consented_at: now, confirmed_at: now })
          .eq("consent_token", token)
        await supabase
          .from("buyers")
          .update({
            sendfox_hidden: false,
            sendfox_suppressed: false,
            can_receive_email: true,
            sendfox_double_opt_in: true,
            sendfox_double_opt_in_at: now,
          })
          .eq("email_norm", email)
      }

      return new Response(
        JSON.stringify({ id: contact?.id ?? null, connected: true, status: "confirmed" }),
        { status: 200 },
      )
    }

    if (doubleOptIn) {
      const consentToken = randomUUID()
      await logConsent(email, listIds, {
        buyerId,
        doubleOptIn: true,
        token: consentToken,
        consented: false,
        request: req,
      })
      const baseUrl =
        process.env.DISPOTOOL_BASE_URL || process.env.SITE_URL || req.nextUrl.origin || "http://localhost:3000"
      const confirmUrl = `${baseUrl}/api/sendfox/contact?token=${consentToken}&email=${encodeURIComponent(email)}&double_opt_in=true`
      try {
        await withSendfoxAuth(authContext, async () =>
          sendEmailCampaign({
            to: email,
            subject: "Confirm your subscription",
            html: `<p>Confirm your subscription to receive updates.</p><p><a href="${confirmUrl}">Confirm subscription</a></p>`,
          }),
        )
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || "confirmation failed" }), { status: 500 })
      }
      return new Response(JSON.stringify({ status: "pending", token: consentToken, connected: true }), { status: 202 })
    }

    const contact = await withSendfoxAuth(authContext, async () =>
      upsertContact(
        email,
        body?.first_name,
        body?.last_name,
        listIds,
        body?.tags,
        body?.ip_address,
      ),
    )

    await logConsent(email, listIds, { buyerId, doubleOptIn: false, consented: true, request: req })
    if (supabase) {
      await supabase
        .from("buyers")
        .update({ sendfox_hidden: false, sendfox_suppressed: false, can_receive_email: true })
        .eq("email_norm", email)
    }

    return new Response(JSON.stringify({ id: contact?.id ?? null, connected: true }), { status: 200 })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "error" }), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  return processContact(req, body)
}

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams
  const body = {
    email: search.get("email") || search.get("contact") || "",
    token: search.get("token"),
    double_opt_in: search.get("double_opt_in") === "true",
    lists: search.get("lists") ? (search.get("lists") || "").split(",") : [],
  }
  return processContact(req, body)
}
