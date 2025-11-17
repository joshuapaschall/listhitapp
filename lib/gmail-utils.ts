export interface GmailMessage {
  id: string
  snippet?: string
  payload?: {
    mimeType?: string
    body?: { data?: string }
    parts?: GmailMessagePayloadPart[]
    headers?: { name: string; value: string }[]
  }
}

export interface GmailMessagePayloadPart {
  mimeType?: string
  body?: { data?: string }
  parts?: GmailMessagePayloadPart[]
}

function decodeData(data?: string): string {
  if (!data) return ""
  const str = data.replace(/-/g, "+").replace(/_/g, "/")
  return Buffer.from(str, "base64").toString("utf8")
}

export interface DecodedMessage {
  text?: string
  html?: string
}

function walk(part: GmailMessagePayloadPart | undefined, out: DecodedMessage) {
  if (!part) return
  const mime = part.mimeType || ""
  if (part.body?.data) {
    if (mime.includes("html")) out.html = decodeData(part.body.data)
    else if (mime.includes("plain")) out.text = decodeData(part.body.data)
  }
  if (part.parts) {
    for (const p of part.parts) {
      walk(p, out)
    }
  }
}

export function decodeMessage(msg: GmailMessage): DecodedMessage {
  const result: DecodedMessage = {}
  walk(msg.payload as GmailMessagePayloadPart, result)
  return result
}
