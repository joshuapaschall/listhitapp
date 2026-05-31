import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { createDraft, buildMessageWithAttachments } from "@/services/gmail-api"
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
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const denied = await requirePermission(supabase, "gmail.access")
  if (denied) return denied
  if (!to && !subject && (!html || html.trim().length === 0)) {
    return NextResponse.json({ error: "Empty draft" }, { status: 400 })
  }
  if (!from) return NextResponse.json({ error: "GMAIL_FROM not configured" }, { status: 500 })

  let totalSize = Buffer.byteLength(html || "", "utf8")
  const attachmentList: Array<{ filename: string; contentType: string; data: Buffer }> = []
  for (const entry of fileEntries) {
    if (entry instanceof File) {
      totalSize += entry.size
      attachmentList.push({ filename: entry.name, contentType: entry.type || "application/octet-stream", data: Buffer.from(await entry.arrayBuffer()) })
    }
  }
  if (totalSize > MAX_TOTAL_SIZE_BYTES) {
    return NextResponse.json({ error: "Draft size exceeds 5MB" }, { status: 413 })
  }

  const text = htmlToPlainText(html || "")

  try {
    const raw = buildMessageWithAttachments({ from, to: to || "", cc: cc || undefined, bcc: bcc || undefined, subject: subject || "", text, html: html || "", attachments: attachmentList })
    const result = await createDraft(user.id, raw)
    return NextResponse.json({ id: (result as any)?.id || null, messageId: (result as any)?.message?.id || null, threadId: (result as any)?.message?.threadId || null })
  } catch (err: any) {
    console.error("Failed to create draft", err)
    return NextResponse.json({ error: err?.message || "error" }, { status: 500 })
  }
}
