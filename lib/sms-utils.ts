const GSM_7BIT = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\u000cÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà".split(
    "",
  ),
)
const GSM_EXTENDED = new Set(["^", "{", "}", "\\", "[", "~", "]", "|", "€"])

export type SmsEncoding = "GSM-7" | "UCS-2"

const EMOJI_RE = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA70}-\u{1FAFF}]/u

export interface SmsSegmentInfo {
  encoding: SmsEncoding
  segments: number
  remaining: number
}

function isGsm(text: string): boolean {
  for (const ch of Array.from(text)) {
    if (!GSM_7BIT.has(ch) && !GSM_EXTENDED.has(ch)) return false
  }
  return true
}

function countGsm(text: string): number {
  let count = 0
  for (const ch of Array.from(text)) {
    count += GSM_EXTENDED.has(ch) ? 2 : 1
  }
  return count
}

function countUcs2(text: string): number {
  let count = 0
  for (const ch of Array.from(text)) {
    count += EMOJI_RE.test(ch) ? 2 : 1
  }
  return count
}

export function calculateSmsSegments(message: string): SmsSegmentInfo {
  const gsm = isGsm(message)
  const charCount = gsm ? countGsm(message) : countUcs2(message)
  const single = gsm ? 160 : 70
  const multi = gsm ? 153 : 67
  const segments = charCount <= single ? 1 : Math.ceil(charCount / multi)
  const capacity = segments === 1 ? single : segments * multi
  const remaining = capacity - charCount
  return { encoding: gsm ? "GSM-7" : "UCS-2", segments, remaining }
}
