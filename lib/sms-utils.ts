const GSM_7BIT = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\u000cÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà".split(
    "",
  ),
)
const GSM_EXTENDED = new Set(["^", "{", "}", "\\", "[", "~", "]", "|", "€"])

export type SmsEncoding = "GSM-7" | "UCS-2"

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

export function calculateSmsSegments(message: string): SmsSegmentInfo {
  const gsm = isGsm(message)
  const charCount = gsm ? countGsm(message) : Array.from(message).length
  const single = gsm ? 160 : 70
  const multi = gsm ? 153 : 67
  const segments = charCount <= single ? 1 : Math.ceil(charCount / multi)
  const capacity = segments === 1 ? single : segments * multi
  const remaining = capacity - charCount
  return { encoding: gsm ? "GSM-7" : "UCS-2", segments, remaining }
}
