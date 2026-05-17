// @ts-nocheck
import { google, gmail_v1 } from "googleapis"
import { createMimeMessage } from "mimetext"
import { supabaseAdmin } from "@/lib/supabase"
import { getAccessToken } from "./gmail-tokens"
import { assertServer } from "@/utils/assert-server"

assertServer()

const REQUIRED_VARS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GMAIL_FROM",
  "NEXT_PUBLIC_GOOGLE_REDIRECT_URI",
] as const

const missing = REQUIRED_VARS.filter((key) => !process.env[key])
if (missing.length) {
  const msg = `Missing Gmail API environment variables: ${missing.join(", ")}`
  console.error(msg)
  throw new Error(msg)
}

const clientId = process.env.GOOGLE_CLIENT_ID!
const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
const redirectUri = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI!

export async function getGmailClient(userId: string) {
  const accessToken = await getAccessToken(userId)
  const oauth = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  oauth.setCredentials({ access_token: accessToken })
  return google.gmail({ version: "v1", auth: oauth })
}

const supabase = supabaseAdmin

function mapFolderToLabelId(folder: string): string | null {
  if (folder === "allMail" || folder === "ALL_MAIL") return null
  const upper = folder.toUpperCase()
  const systemIds = ["INBOX", "STARRED", "IMPORTANT", "SENT", "DRAFT", "DRAFTS", "TRASH", "SPAM", "UNREAD", "CHAT"]
  if (systemIds.includes(upper)) return upper === "DRAFTS" ? "DRAFT" : upper
  const mapping: Record<string, string> = { inbox: "INBOX", starred: "STARRED", important: "IMPORTANT", sent: "SENT", drafts: "DRAFT", trash: "TRASH", spam: "SPAM" }
  if (mapping[folder]) return mapping[folder]
  if (folder.startsWith("Label_")) return folder
  return folder
}

async function safeCall<T>(fn: () => Promise<T>, fallback?: T): Promise<T> {
  try {
    return await fn()
  } catch (err: any) {
    console.error(err.response?.data || err.message)
    const msg =
      err?.response?.status === 401 ||
      err?.response?.status === 403 ||
      /invalid(_| )?(token|grant)/i.test(err?.message || "")
        ? "Failed to authenticate with Gmail. Check your credentials."
        : null
    if (msg) {
      throw new Error(msg)
    }
    if (fallback !== undefined) return fallback
    throw err
  }
}

export interface GmailMessage extends gmail_v1.Schema$Message {}

export interface GmailThread extends gmail_v1.Schema$Thread {
  starred?: boolean
  unread?: boolean
}

export async function listThreads(
  userId: string,
  maxResults = 50,
  folder = "inbox",
  options: { includeSpamTrash?: boolean; pageToken?: string; q?: string } = {},
): Promise<{
  threads: GmailThread[]
  nextPageToken: string | null
  resultSizeEstimate: number
}> {
  const gmail = await getGmailClient(userId)
  const isAllMail = folder === "allMail" || folder === "ALL_MAIL"
  const normalized = isAllMail ? null : (mapFolderToLabelId(folder) || null)

  let threads: GmailThread[] = []
  const listParams: any = { userId: "me", maxResults, format: "full" as any }
  if (normalized) listParams.labelIds = [normalized]
  if (options.pageToken) listParams.pageToken = options.pageToken
  if (options.includeSpamTrash || normalized === "TRASH" || normalized === "SPAM") {
    listParams.includeSpamTrash = true
  }
  if (options.q && options.q.trim().length > 0) {
    listParams.q = options.q.trim()
  }

  let res = await safeCall(() => gmail.users.threads.list(listParams), null as any)
  if (!res) {
    const fallbackParams = { ...listParams }
    delete fallbackParams.format
    res = await safeCall(() => gmail.users.threads.list(fallbackParams), { data: { threads: [] } } as any)
  }
  threads = res.data.threads || []

  if (threads.length) {
    const rows = threads.map((t) => {
      const labels = new Set<string>()
      for (const m of t.messages || []) {
        for (const l of m.labelIds || []) labels.add(l)
      }
      return {
        id: t.id!,
        snippet: t.snippet || null,
        history_id: t.historyId || null,
        starred: labels.has("STARRED"),
        unread: labels.has("UNREAD"),
        updated_at: new Date().toISOString(),
      }
    })
    await supabase.from("gmail_threads").upsert(rows)

    const addressSet = new Set<string>()
    const threadMeta: Record<string, { subject: string | null; snippet: string | null; starred: boolean; unread: boolean; emails: string[] }> = {}
    threads.forEach((t, i) => {
      const first = t.messages?.[0]
      const headers = (first?.payload?.headers || []) as gmail_v1.Schema$MessagePartHeader[]
      const getHeader = (name: string) => headers.find((h) => h.name === name)?.value || ""
      const from = getHeader("From")
      const to = getHeader("To")
      const subject = getHeader("Subject") || null
      const emails: string[] = []
      ;[from, to].forEach((v) => {
        ;(v || "").split(/[, ]+/).forEach((p) => {
          const m = p.match(/<(.+@.+)>/)
          const addr = m ? m[1] : p
          const norm = addr.trim().toLowerCase()
          if (norm) {
            emails.push(norm)
            addressSet.add(norm)
          }
        })
      })
      threadMeta[t.id!] = {
        subject,
        snippet: t.snippet || null,
        starred: rows[i].starred,
        unread: rows[i].unread,
        emails,
      }
    })

    let buyerMap: Record<string, string> = {}
    if (addressSet.size) {
      const { data } = await supabase
        .from("buyers")
        .select("id,email_norm")
        .in("email_norm", Array.from(addressSet))
      buyerMap = Object.fromEntries((data || []).map((b: any) => [b.email_norm, b.id]))
    }

    const emailRows: any[] = []
    for (const id of Object.keys(threadMeta)) {
      const meta = threadMeta[id]
      for (const email of meta.emails) {
        const buyerId = buyerMap[email]
        if (buyerId) {
          emailRows.push({
            thread_id: id,
            buyer_id: buyerId,
            subject: meta.subject,
            snippet: meta.snippet,
            starred: meta.starred,
            unread: meta.unread,
            updated_at: new Date().toISOString(),
          })
        }
      }
    }
    if (emailRows.length) {
      await supabase.from("email_threads").upsert(emailRows)
    }

    threads = threads.map((t, i) => ({ ...t, starred: rows[i].starred, unread: rows[i].unread }))
  }

  return {
    threads,
    nextPageToken: (res?.data?.nextPageToken as string | undefined) || null,
    resultSizeEstimate: (res?.data?.resultSizeEstimate as number | undefined) || 0,
  }
}

export async function getThread(
  userId: string,
  id: string,
): Promise<GmailThread> {
  const gmail = await getGmailClient(userId)
  const res = await safeCall(
    () => gmail.users.threads.get({ userId: "me", id }),
    { data: {} } as any,
  )
  const data = res.data as GmailThread
  if (data?.id) {
    const labels = new Set<string>()
    for (const m of data.messages || []) {
      for (const l of m.labelIds || []) labels.add(l)
    }
    const starred = labels.has("STARRED")
    const unread = labels.has("UNREAD")
    await supabase.from("gmail_threads").upsert({
      id: data.id,
      snippet: data.snippet || null,
      history_id: data.historyId || null,
      starred,
      unread,
      updated_at: new Date().toISOString(),
    })
    return { ...data, starred, unread }
  }
  return data
}

export async function setThreadStarred(
  userId: string,
  id: string,
  starred: boolean,
) {
  const gmail = await getGmailClient(userId)
  await safeCall(
    () =>
      gmail.users.threads.modify({
        userId: "me",
        id,
        requestBody: starred
          ? { addLabelIds: ["STARRED"], removeLabelIds: [] }
          : { addLabelIds: [], removeLabelIds: ["STARRED"] },
      }),
  )
  await supabase.from("gmail_threads").update({ starred }).eq("id", id)
}

export async function setThreadUnread(
  userId: string,
  id: string,
  unread: boolean,
) {
  const gmail = await getGmailClient(userId)
  await safeCall(
    () =>
      gmail.users.threads.modify({
        userId: "me",
        id,
        requestBody: unread
          ? { addLabelIds: ["UNREAD"], removeLabelIds: [] }
          : { addLabelIds: [], removeLabelIds: ["UNREAD"] },
      }),
  )
  await supabase.from("gmail_threads").update({ unread }).eq("id", id)
}


export async function sendEmail(
  userId: string,
  raw: string,
  threadId?: string,
): Promise<ReturnType<gmail_v1.Gmail["users"]["messages"]["send"]>> {
  const gmail = await getGmailClient(userId)
  const requestBody: gmail_v1.Schema$Message = { raw }
  if (threadId) requestBody.threadId = threadId
  return safeCall(
    () => gmail.users.messages.send({ userId: "me", requestBody }),
    {} as any,
  )
}

interface BaseMailOptions {
  to: string
  from: string
  subject: string
  text: string
  html?: string
}

interface ReplyOptions extends BaseMailOptions {
  inReplyTo: string
  references?: string[]
}

function encode(body: string) {
  return Buffer.from(body)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

export function buildMessage(opts: BaseMailOptions) {
  return encode(buildMime(opts))
}

export function buildReply(opts: ReplyOptions) {
  const headers: Record<string, string> = {
    "In-Reply-To": opts.inReplyTo,
    References: [...(opts.references || []), opts.inReplyTo].join(" "),
  }
  return encode(buildMime(opts, headers))
}

export async function deleteThread(
  userId: string,
  id: string,
): Promise<ReturnType<gmail_v1.Gmail["users"]["threads"]["trash"]>> {
  const gmail = await getGmailClient(userId)
  return safeCall(
    () => gmail.users.threads.trash({ userId: "me", id }),
    {} as any,
  )
}

export async function archiveThread(
  userId: string,
  id: string,
): Promise<ReturnType<gmail_v1.Gmail["users"]["threads"]["modify"]>> {
  const gmail = await getGmailClient(userId)
  return safeCall(
    () =>
      gmail.users.threads.modify({
        userId: "me",
        id,
        requestBody: { removeLabelIds: ["INBOX"] },
      }),
    {} as any,
  )
}

function buildMime(opts: BaseMailOptions, extra: Record<string, string> = {}) {
  const boundary = "dispotool-boundary"
  const lines: string[] = []
  lines.push(`From: ${opts.from}`)
  lines.push(`To: ${opts.to}`)
  lines.push(`Subject: ${opts.subject}`)
  for (const [k, v] of Object.entries(extra)) {
    lines.push(`${k}: ${v}`)
  }
  if (opts.html) {
    lines.push("MIME-Version: 1.0")
    lines.push(`Content-Type: multipart/alternative; boundary=\"${boundary}\"`)
    lines.push("")
    lines.push(`--${boundary}`)
    lines.push("Content-Type: text/plain; charset=\"UTF-8\"")
    lines.push("")
    lines.push(opts.text)
    lines.push("")
    lines.push(`--${boundary}`)
    lines.push("Content-Type: text/html; charset=\"UTF-8\"")
    lines.push("")
    lines.push(opts.html)
    lines.push("")
    lines.push(`--${boundary}--`)
  } else {
    lines.push("MIME-Version: 1.0")
    lines.push("Content-Type: text/plain; charset=\"UTF-8\"")
    lines.push("")
    lines.push(opts.text)
  }
  return lines.join("\r\n")
}


interface Attachment {
  filename: string
  contentType: string
  data: Buffer
}

interface ExtendedMailOptions {
  from: string
  to: string
  cc?: string
  bcc?: string
  subject: string
  text: string
  html?: string
  attachments?: Attachment[]
}

interface ExtendedReplyOptions extends ExtendedMailOptions {
  inReplyTo: string
  references?: string[]
}

function buildMimeWithMimetext(
  opts: ExtendedMailOptions,
  extraHeaders: Record<string, string> = {},
): string {
  const msg = createMimeMessage()
  msg.setSender(opts.from)
  const toList = opts.to.split(",").map((part) => part.trim()).filter(Boolean)
  msg.setRecipients(toList)
  if (opts.cc) {
    const ccList = opts.cc.split(",").map((part) => part.trim()).filter(Boolean)
    if (ccList.length) msg.setCc(ccList)
  }
  if (opts.bcc) {
    const bccList = opts.bcc.split(",").map((part) => part.trim()).filter(Boolean)
    if (bccList.length) msg.setBcc(bccList)
  }
  msg.setSubject(opts.subject)

  Object.entries(extraHeaders).forEach(([key, value]) => {
    msg.setHeader(key, value)
  })

  msg.addMessage({ contentType: "text/plain", data: opts.text })
  if (opts.html) {
    msg.addMessage({ contentType: "text/html", data: opts.html })
  }

  if (opts.attachments?.length) {
    opts.attachments.forEach((att) => {
      msg.addAttachment({
        filename: att.filename,
        contentType: att.contentType || "application/octet-stream",
        data: att.data.toString("base64"),
      })
    })
  }

  return msg.asRaw()
}

function encodeBase64Url(raw: string): string {
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

export function buildMessageWithAttachments(opts: ExtendedMailOptions): string {
  return encodeBase64Url(buildMimeWithMimetext(opts))
}

export function buildReplyWithAttachments(opts: ExtendedReplyOptions): string {
  const headers: Record<string, string> = {
    "In-Reply-To": opts.inReplyTo,
    References: [...(opts.references || []), opts.inReplyTo].join(" "),
  }
  return encodeBase64Url(buildMimeWithMimetext(opts, headers))
}

export async function listDrafts(userId: string): Promise<Array<{
  id: string
  messageId: string | null
  threadId: string | null
}>> {
  const gmail = await getGmailClient(userId)
  const res = await safeCall(
    () => gmail.users.drafts.list({ userId: "me", maxResults: 500 }),
    { data: { drafts: [] } } as any,
  )
  return (res.data.drafts || []).map((d: any) => ({
    id: d.id,
    messageId: d.message?.id || null,
    threadId: d.message?.threadId || null,
  }))
}

export async function getDraft(userId: string, draftId: string) {
  const gmail = await getGmailClient(userId)
  const res = await safeCall(
    () => gmail.users.drafts.get({ userId: "me", id: draftId, format: "full" as any }),
    { data: {} } as any,
  )
  return res.data
}


export async function createDraft(userId: string, raw: string) {
  const gmail = await getGmailClient(userId)
  const res = await safeCall(
    () => gmail.users.drafts.create({
      userId: "me",
      requestBody: { message: { raw } },
    }),
    {} as any,
  )
  return res.data
}

export async function sendDraft(userId: string, draftId: string) {
  const gmail = await getGmailClient(userId)
  const res = await safeCall(
    () => gmail.users.drafts.send({ userId: "me", requestBody: { id: draftId } }),
    {} as any,
  )
  return res.data
}

export async function updateDraft(
  userId: string,
  draftId: string,
  raw: string,
) {
  const gmail = await getGmailClient(userId)
  const res = await safeCall(
    () => gmail.users.drafts.update({
      userId: "me",
      id: draftId,
      requestBody: { message: { raw } },
    }),
    {} as any,
  )
  return res.data
}

export default {
  getGmailClient,
  listThreads,
  getThread,
  sendEmail,
  buildMessage,
  buildReply,
  buildMessageWithAttachments,
  buildReplyWithAttachments,
  archiveThread,
  deleteThread,
  setThreadStarred,
  setThreadUnread,
  listDrafts,
  getDraft,
  sendDraft,
  updateDraft,
  createDraft,
}

