// Telnyx-accurate SMS segment engine (long-code, GSM-7 default with automatic
// UTF-16 fallback). Replicates Telnyx's published Segment Calculator so our
// per-segment billing estimates match theirs exactly.

// GSM 7-bit base set (each char counts as 1). Sourced verbatim from Telnyx.
// NOTE: € § ¤ Ç Greek capitals and form-feed are intentionally NOT here — on
// Telnyx they force UTF-16 even though some are technically GSM.
const GSM_BASE = new Set<string>([
  ..."0123456789",
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  ..."abcdefghijklmnopqrstuvwxyz",
  "\n",
  "\r",
  " ",
  ..."!\"#$%&'()*+,-./:;<=>?@_",
  ..."£¥èéùìòØøÅåÆæßÉ¡ÄÖÑÜ¿äöñüà",
])

// GSM 7-bit extended set (still GSM, but each counts as 2 chars).
const GSM_EXTENDED = new Set<string>(["[", "\\", "]", "^", "{", "}", "|", "~"])

export type SmsEncoding = "GSM-7" | "UCS-2"

// Broader emoji matcher (8 ranges) kept exported for the cost guard's
// strip/detect use. Intentionally wider than the limit-decision regex below.
export const EMOJI_RE =
  /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA70}-\u{1FAFF}]/u

// Telnyx `hasEmojis` — the EXACT 6-range set used to decide the UTF-16
// per-segment limit (35/33 with emoji, 70/67 without). Intentionally narrower
// than EMOJI_RE.
const HAS_EMOJI_RE =
  /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u

export interface SmsSegmentInfo {
  encoding: SmsEncoding
  segments: number
  remaining: number
  charCount: number
  charsPerSegment: number
}

function isGsm(text: string): boolean {
  for (const ch of Array.from(text)) {
    if (!GSM_BASE.has(ch) && !GSM_EXTENDED.has(ch)) return false
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

  // GSM counts extended chars as 2; UTF-16 uses the JS code-unit length (a
  // non-BMP emoji is 2 units).
  const charCount = gsm ? countGsm(message) : message.length

  let single: number
  let multi: number
  if (gsm) {
    single = 160
    multi = 153
  } else if (HAS_EMOJI_RE.test(message)) {
    single = 35
    multi = 33
  } else {
    single = 70
    multi = 67
  }

  const segments = charCount <= single ? (charCount > 0 ? 1 : 0) : Math.ceil(charCount / multi)
  const capacity = segments <= 1 ? single : segments * multi
  const remaining = capacity - charCount
  const charsPerSegment = segments <= 1 ? single : multi

  return {
    encoding: gsm ? "GSM-7" : "UCS-2",
    segments,
    remaining,
    charCount,
    charsPerSegment,
  }
}
