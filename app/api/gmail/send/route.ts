import { NextRequest } from "next/server"
import { buildMessage, sendEmail, getThread } from "@/services/gmail-api"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { normalizeEmail } from "@/lib/dedup-utils"
import { supabaseAdmin } from "@/lib/supabase"
import { assertServer } from "@/utils/assert-server"

assertServer()

const fromAddress = process.env.GMAIL_FROM || ""

export async function POST(request: NextRequest) {
  const { to, subject, text, html } = await request.json()
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }
  const userId = user.id

  if (!to || !subject || !text) {
    return new Response(
      JSON.stringify({ error: "to, subject and text are required" }),
      { status: 400 },
    )
  }

  if (!fromAddress) {
    return new Response(JSON.stringify({ error: "GMAIL_FROM not configured" }), { status: 500 })
  }

  try {
    const raw = buildMessage({ to, from: fromAddress, subject, text, html })
    const res = await sendEmail(userId, raw)
    // @ts-ignore
    const id = (res as any)?.data?.id
    // @ts-ignore
    const threadId = (res as any)?.data?.threadId
    if (threadId) {
      try {
        await getThread(userId, threadId)
        const emailNorm = normalizeEmail(to)
        if (emailNorm) {
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
        }
      } catch (err) {
        console.error("Failed to upsert thread", err)
      }
    }
    return new Response(JSON.stringify({ id, threadId }))
  } catch (err: any) {
    console.error("Failed to send email", err)
    return new Response(JSON.stringify({ error: err.message || "error" }), { status: 500 })
  }
}
