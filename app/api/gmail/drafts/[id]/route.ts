import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { getDraft, updateDraft, buildMessageWithAttachments } from "@/services/gmail-api"
import { decodeMessage } from "@/lib/gmail-utils"
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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const denied = await requirePermission(supabase, "gmail.access")
  if (denied) return denied

  try {
    const draft = await getDraft(user.id, params.id)
    const message = draft.message
    if (!message) return NextResponse.json({ draft: null })

    const headers = message.payload?.headers || []
    const headerOf = (name: string): string =>
      headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || ""
    const decoded = decodeMessage(message as any)
    return NextResponse.json({
      draft: {
        id: draft.id,
        messageId: message.id || null,
        threadId: message.threadId || null,
        to: headerOf("To"),
        cc: headerOf("Cc"),
        bcc: headerOf("Bcc"),
        subject: headerOf("Subject"),
        html: decoded.html || decoded.text || "",
      },
    })
  } catch (err: any) {
    console.error("Failed to get draft", err)
    return NextResponse.json({ error: err?.message || "error" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
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
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const denied = await requirePermission(supabase, "gmail.access")
  if (denied) return denied
  if (!to || !subject || html === null) {
    return NextResponse.json(
      { error: "to, subject and html are required" },
      { status: 400 },
    )
  }
  if (!from) {
    return NextResponse.json({ error: "GMAIL_FROM not configured" }, { status: 500 })
  }

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
    return NextResponse.json(
      { error: "Message size exceeds 5MB. Reduce attachment size." },
      { status: 413 },
    )
  }

  const text = htmlToPlainText(html)

  try {
    const raw = buildMessageWithAttachments({
      from,
      to,
      cc: cc || undefined,
      bcc: bcc || undefined,
      subject,
      text,
      html,
      attachments: attachmentList,
    })
    const result = await updateDraft(user.id, params.id, raw)
    return NextResponse.json({
      id: (result as any)?.id || params.id,
      messageId: (result as any)?.message?.id || null,
      threadId: (result as any)?.message?.threadId || null,
    })
  } catch (err: any) {
    console.error("Failed to update draft", err)
    return NextResponse.json({ error: err?.message || "error" }, { status: 500 })
  }
}
