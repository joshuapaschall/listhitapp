import { apiError } from "@/lib/api-error"
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
import { assertServer } from "@/utils/assert-server"
import { requirePermission } from "@/lib/permissions/server"

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
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  const denied = await requirePermission(supabase, "gmail.access")
  if (denied) return denied
  const contentType = request.headers.get("content-type") ?? ""
  const isFormData = contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")
  const formData = isFormData ? await request.formData() : null
  const json = formData ? null : await request.json().catch(() => ({}))
  const from = ((formData?.get("from") as string | null) || json?.from || defaultFromAddress) as string
  const to = (formData?.get("to") as string | null) || json?.to || null
  const cc = (formData?.get("cc") as string | null) || json?.cc || null
  const bcc = (formData?.get("bcc") as string | null) || json?.bcc || null
  const subject = (formData?.get("subject") as string | null) || json?.subject || null
  const html = (formData?.get("html") as string | null) || json?.html || undefined
  const plainText = (formData?.get("text") as string | null) || json?.text || null
  const fileEntries = formData?.getAll("attachments") ?? []

  if (!to || !subject || (!html && !plainText)) return new Response(JSON.stringify({ error: "to, subject and html are required" }), { status: 400 })
  if (!from) return new Response(JSON.stringify({ error: "GMAIL_FROM not configured" }), { status: 500 })

  const text = plainText || htmlToPlainText(html || "")
  let totalSize = Buffer.byteLength(html || text, "utf8")
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
          const { data: buyer } = await supabase.from("buyers").select("id").eq("email_norm", emailNorm).maybeSingle()
          if (buyer) {
            await supabase.from("email_messages").insert({ thread_id: threadId, buyer_id: buyer.id, subject, preview: text.slice(0, 200), sent_at: new Date().toISOString() })
          }
        }
      } catch (err) {
        console.error("Failed to upsert thread", err)
      }
    }
    return new Response(JSON.stringify({ id, threadId }))
  } catch (err: any) {
    console.error("Failed to send email", err)
    return apiError(err, 500)
  }
}
