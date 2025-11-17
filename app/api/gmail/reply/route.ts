import { NextRequest } from "next/server"
import { getThread, buildReply, sendEmail } from "@/services/gmail-api"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { normalizeEmail } from "@/lib/dedup-utils"
import { supabaseAdmin } from "@/lib/supabase"
import { assertServer } from "@/utils/assert-server"

assertServer()

const fromAddress = process.env.GMAIL_FROM || ""

export async function POST(request: NextRequest) {
  const { threadId, to, subject, text, html } = await request.json()
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }
  const userId = user.id

  if (!threadId || !to || !subject || !text) {
    return new Response(
      JSON.stringify({ error: "threadId, to, subject and text are required" }),
      { status: 400 },
    )
  }

  if (!fromAddress) {
    return new Response(JSON.stringify({ error: "GMAIL_FROM not configured" }), { status: 500 })
  }

  try {
    const thread = await getThread(userId, threadId)
    const msgs: any[] = (thread as any)?.messages || []
    const last = msgs[msgs.length - 1]
    let inReplyTo = ""
    let refs: string[] = []
    if (last?.payload?.headers) {
      for (const h of last.payload.headers) {
        const name = String(h.name || "").toLowerCase()
        if (name === "message-id") inReplyTo = h.value
        if (name === "references") refs = h.value.split(" ")
      }
    }
    if (!inReplyTo) {
      return new Response(JSON.stringify({ error: "Message-ID not found" }), { status: 400 })
    }
    const raw = buildReply({ to, from: fromAddress, subject, text, html, inReplyTo, references: refs })
    const res = await sendEmail(userId, raw, threadId)
    // @ts-ignore
    const id = (res as any)?.data?.id
    const emailNorm = normalizeEmail(to)
    if (emailNorm) {
      try {
        await getThread(userId, threadId)
        const { data: buyer } = await supabaseAdmin
          .from("buyers")
          .select("id")
          .eq("email_norm", emailNorm)
          .maybeSingle()
        if (buyer) {
          await supabaseAdmin.from("email_messages").insert({
            thread_id: threadId,
            buyer_id: buyer.id,
            subject,
            preview: text.slice(0, 200),
            sent_at: new Date().toISOString(),
          })
        }
      } catch (err) {
        console.error("Failed to log email reply", err)
      }
    }
    return new Response(JSON.stringify({ id }))
  } catch (err: any) {
    console.error("Failed to send reply", err)
    return new Response(JSON.stringify({ error: err.message || "error" }), { status: 500 })
  }
}
