// SMS cost guard. Detects cost-inflating characters (curly quotes, long dashes,
// ellipses, non-breaking spaces, GSM-extended symbols, stray Unicode, emoji),
// proposes a GSM-safe lossless fix, and reports the segment savings. Pure module
// — no DB, no React. Segment math comes from the Telnyx-accurate engine in
// sms-utils.ts.

import { calculateSmsSegments, EMOJI_RE } from "@/lib/sms-utils"
import { BLENDED_SMS_RATE_USD } from "@/lib/sms-pricing"

export type CostIssueType =
  | "curly_quote"
  | "dash"
  | "ellipsis"
  | "nbsp"
  | "gsm_extended"
  | "other_unicode"
  | "emoji"

export interface CostIssue {
  type: CostIssueType
  label: string
  chars: string[]
  count: number
  replacement: string
  lossless: boolean
}

export interface SegInfo {
  segments: number
  encoding: "GSM-7" | "UCS-2"
}

export interface CostAnalysis {
  original: string
  optimized: string
  optimizedNoEmoji: string
  before: SegInfo
  after: SegInfo
  afterNoEmoji: SegInfo
  issues: CostIssue[]
  hasEmoji: boolean
  canSave: boolean
  savingsPerRecipient: number
  savingsPerRecipientNoEmoji: number
  nearBoundary: null | { trimChars: number; savingsPerRecipient: number }
}

// Lossless fold tables (each maps to an ASCII GSM equivalent).
const QUOTE_SINGLE = ["‘", "’", "‚", "‛", "′"]
const QUOTE_DOUBLE = ["“", "”", "„", "‟", "″"]
const DASHES = ["–", "—", "―"]
const ELLIPSIS = ["…"]
const NBSPS = [" ", " ", " "]

// GSM 7-bit extended chars — valid GSM but each costs 2 chars. Flagged, never
// auto-changed (mirrors the set in sms-utils.ts).
const GSM_EXTENDED_CHARS = ["[", "\\", "]", "^", "{", "}", "|", "~"]

const GSM_MULTI = 153

function replaceAll(text: string, find: string, repl: string): string {
  return text.split(find).join(repl)
}

export function optimizeMessage(message: string, opts: { stripEmoji?: boolean } = {}): string {
  let out = message

  if (opts.stripEmoji) {
    out = out.replace(new RegExp(EMOJI_RE.source, "gu"), "")
  }

  for (const c of QUOTE_SINGLE) out = replaceAll(out, c, "'")
  for (const c of QUOTE_DOUBLE) out = replaceAll(out, c, '"')
  for (const c of DASHES) out = replaceAll(out, c, "-")
  out = replaceAll(out, "…", "...")
  for (const c of NBSPS) out = replaceAll(out, c, " ")

  // Collapse runs of spaces/tabs (not newlines) to one, then trim trailing
  // whitespace per line. Words are never deleted.
  out = out.replace(/[ \t]+/g, " ")
  out = out.replace(/[ \t]+$/gm, "")

  return out
}

function countOccurrences(message: string, chars: string[]): { found: string[]; count: number } {
  const found: string[] = []
  let count = 0
  for (const c of chars) {
    const n = message.split(c).length - 1
    if (n > 0) {
      found.push(c)
      count += n
    }
  }
  return { found, count }
}

function isGsmChar(ch: string): boolean {
  return calculateSmsSegments(ch).encoding === "GSM-7"
}

function seg(message: string): SegInfo {
  const info = calculateSmsSegments(message)
  return { segments: info.segments, encoding: info.encoding }
}

function computeNearBoundary(message: string): null | { trimChars: number; savingsPerRecipient: number } {
  const info = calculateSmsSegments(message)
  if (info.encoding !== "GSM-7") return null
  if (info.segments < 2) return null
  // Chars sitting in the final (partial) segment; trimming them drops a segment.
  const lastSegment = info.charCount - (info.segments - 1) * GSM_MULTI
  if (lastSegment > 0 && lastSegment <= 10) {
    return { trimChars: lastSegment, savingsPerRecipient: BLENDED_SMS_RATE_USD }
  }
  return null
}

export function analyzeMessage(message: string): CostAnalysis {
  const original = message
  const optimized = optimizeMessage(message)
  const optimizedNoEmoji = optimizeMessage(message, { stripEmoji: true })

  const before = seg(message)
  const after = seg(optimized)
  const afterNoEmoji = seg(optimizedNoEmoji)

  const issues: CostIssue[] = []

  const quotes = countOccurrences(message, [...QUOTE_SINGLE, ...QUOTE_DOUBLE])
  if (quotes.count) {
    issues.push({ type: "curly_quote", label: "Curly quotes", chars: quotes.found, count: quotes.count, replacement: "' \"", lossless: true })
  }
  const dashes = countOccurrences(message, DASHES)
  if (dashes.count) {
    issues.push({ type: "dash", label: "Long dashes", chars: dashes.found, count: dashes.count, replacement: "-", lossless: true })
  }
  const ell = countOccurrences(message, ELLIPSIS)
  if (ell.count) {
    issues.push({ type: "ellipsis", label: "Ellipsis", chars: ell.found, count: ell.count, replacement: "...", lossless: true })
  }
  const nb = countOccurrences(message, NBSPS)
  if (nb.count) {
    issues.push({ type: "nbsp", label: "Non-breaking spaces", chars: nb.found, count: nb.count, replacement: "(space)", lossless: true })
  }

  // Scan code points for emoji, GSM-extended doublers, and stray Unicode that
  // forces UTF-16 with no safe fold.
  const foldable = new Set([...QUOTE_SINGLE, ...QUOTE_DOUBLE, ...DASHES, ...ELLIPSIS, ...NBSPS])
  const emojiFound: string[] = []
  const emojiSeen = new Set<string>()
  let emojiCount = 0
  const otherFound: string[] = []
  const otherSeen = new Set<string>()
  let otherCount = 0
  for (const ch of Array.from(message)) {
    if (EMOJI_RE.test(ch)) {
      emojiCount++
      if (!emojiSeen.has(ch)) {
        emojiSeen.add(ch)
        emojiFound.push(ch)
      }
      continue
    }
    if (foldable.has(ch)) continue
    if (GSM_EXTENDED_CHARS.includes(ch)) continue
    if (!isGsmChar(ch)) {
      otherCount++
      if (!otherSeen.has(ch)) {
        otherSeen.add(ch)
        otherFound.push(ch)
      }
    }
  }

  const ext = countOccurrences(message, GSM_EXTENDED_CHARS)
  if (ext.count) {
    issues.push({ type: "gsm_extended", label: "Symbols that count double", chars: ext.found, count: ext.count, replacement: "", lossless: false })
  }
  if (otherCount) {
    issues.push({ type: "other_unicode", label: "Special characters", chars: otherFound, count: otherCount, replacement: "", lossless: false })
  }
  const hasEmoji = emojiCount > 0
  if (hasEmoji) {
    issues.push({ type: "emoji", label: "Emoji", chars: emojiFound, count: emojiCount, replacement: "", lossless: false })
  }

  const canSave = after.segments < before.segments || afterNoEmoji.segments < before.segments
  const savingsPerRecipient = Math.max(0, before.segments - after.segments) * BLENDED_SMS_RATE_USD
  const savingsPerRecipientNoEmoji = Math.max(0, before.segments - afterNoEmoji.segments) * BLENDED_SMS_RATE_USD

  const nearBoundary = issues.length === 0 ? computeNearBoundary(message) : null

  return {
    original,
    optimized,
    optimizedNoEmoji,
    before,
    after,
    afterNoEmoji,
    issues,
    hasEmoji,
    canSave,
    savingsPerRecipient,
    savingsPerRecipientNoEmoji,
    nearBoundary,
  }
}
