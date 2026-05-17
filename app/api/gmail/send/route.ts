import { NextRequest } from "next/server"
import {
  buildMessage,
  buildMessageWithAttachments,
  sendEmail,
  getThread,
} from "@/services/gmail-api"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { normalizeEmail } from "@/lib/dedup-utils"
import { supabaseAdmin } from "@/lib/supabase"
import { assertServer } from "@/utils/assert-server"

assertServer()

const defaultFromAddress = process.env.GMAIL_FROM || ""
const MAX_TOTAL_SIZE_BYTES = 5 * 1024 * 1024

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const from = (formData.get("from") as string | null) || defaultFromAddress
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
  if (!to || !subject || !html) return new Response(JSON.stringify({ error: "to, subject and html are required" }), { status: 400 })
  if (!from) return new Response(JSON.stringify({ error: "GMAIL_FROM not configured" }), { status: 500 })

  let totalSize = Buffer.byteLength(html, "utf8")
  const attachmentList: Array<{ filename: string; contentType: string; data: Buffer }> = []
  for (const entry of fileEntries) {
    if (entry instanceof File) {
      totalSize += entry.size
      attachmentList.push({
        filename: entry.name,
        contentType: entry.type || "application/octet-stream",
        data: Buffer.from(await entry.arrayBuffer()),
      })
    }
  }
  if (totalSize > MAX_TOTAL_SIZE_BYTES) {
    // TODO: move oversized attachment handling to signed-upload flow.
    return new Response(JSON.stringify({ error: "Message size exceeds 5MB. Reduce attachment size." }), { status: 413 })
  }

  const text = htmlToPlainText(html)

  try {
    const useRichBuilder = attachmentList.length > 0 || !!cc || !!bcc
    const finalRaw = useRichBuilder
      ? buildMessageWithAttachments({ from, to, cc: cc || undefined, bcc: bcc || undefined, subject, text, html, attachments: attachmentList })
      : buildMessage({ to, from, subject, text, html })

    const res = await sendEmail(user.id, finalRaw)
    const id = (res as any)?.data?.id
    const threadId = (res as any)?.data?.threadId
    if (threadId) {
      try {
        await getThread(user.id, threadId)
        const emailNorm = normalizeEmail(to)
        if (emailNorm) {
          const { data: buyer } = await supabaseAdmin.from("buyers").select("id").eq("email_norm", emailNorm).maybeSingle()
          if (buyer) {
            await supabaseAdmin.from("email_messages").insert({ thread_id: threadId, buyer_id: buyer.id, subject, preview: text.slice(0, 200), sent_at: new Date().toISOString() })
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
