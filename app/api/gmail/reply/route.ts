import { NextRequest } from "next/server"
import { getThread, buildReply, buildReplyWithAttachments, sendEmail } from "@/services/gmail-api"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { normalizeEmail } from "@/lib/dedup-utils"
import { supabaseAdmin } from "@/lib/supabase"
import { assertServer } from "@/utils/assert-server"

assertServer()

const defaultFromAddress = process.env.GMAIL_FROM || ""
const MAX_TOTAL_SIZE_BYTES = 5 * 1024 * 1024

function htmlToPlainText(html: string): string {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<\/div>/gi, "\n").replace(/<\/li>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/\n{3,}/g, "\n\n").trim()
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const from = (formData.get("from") as string | null) || defaultFromAddress
  const threadId = formData.get("threadId") as string | null
  const to = formData.get("to") as string | null
  const cc = formData.get("cc") as string | null
  const bcc = formData.get("bcc") as string | null
  const subject = formData.get("subject") as string | null
  const html = formData.get("html") as string | null
  const fileEntries = formData.getAll("attachments")
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  const userId = user.id
  if (!threadId || !to || !subject || !html) return new Response(JSON.stringify({ error: "threadId, to, subject and html are required" }), { status: 400 })
  if (!from) return new Response(JSON.stringify({ error: "GMAIL_FROM not configured" }), { status: 500 })

  let totalSize = Buffer.byteLength(html, "utf8")
  const attachmentList: Array<{ filename: string; contentType: string; data: Buffer }> = []
  for (const entry of fileEntries) {
    if (entry instanceof File) {
      totalSize += entry.size
      attachmentList.push({ filename: entry.name, contentType: entry.type || "application/octet-stream", data: Buffer.from(await entry.arrayBuffer()) })
    }
  }
  if (totalSize > MAX_TOTAL_SIZE_BYTES) {
    // TODO: move oversized attachment handling to signed-upload flow.
    return new Response(JSON.stringify({ error: "Message size exceeds 5MB. Reduce attachment size." }), { status: 413 })
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
        if (name === "references") refs = h.value.split(" ").filter(Boolean)
      }
    }
    if (!inReplyTo) return new Response(JSON.stringify({ error: "Message-ID not found in thread" }), { status: 400 })

    const text = htmlToPlainText(html)
    const useRichBuilder = attachmentList.length > 0 || !!cc || !!bcc
    const raw = useRichBuilder
      ? buildReplyWithAttachments({ from, to, cc: cc || undefined, bcc: bcc || undefined, subject, text, html, inReplyTo, references: refs, attachments: attachmentList })
      : buildReply({ to, from, subject, text, html, inReplyTo, references: refs })

    const res = await sendEmail(userId, raw, threadId)
    const id = (res as any)?.data?.id
    const emailNorm = normalizeEmail(to)
    if (emailNorm) {
      try {
        await getThread(userId, threadId)
        const { data: buyer } = await supabaseAdmin.from("buyers").select("id").eq("email_norm", emailNorm).maybeSingle()
        if (buyer) {
          await supabaseAdmin.from("email_messages").insert({ thread_id: threadId, buyer_id: buyer.id, subject, preview: text.slice(0, 200), sent_at: new Date().toISOString() })
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
