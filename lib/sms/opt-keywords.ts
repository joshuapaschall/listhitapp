export type InboundIntent = "stop" | "help" | "start" | null

export const STOP_KEYWORDS = [
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
  "OPTOUT",
  "OPT OUT",
  "REMOVE",
] as const

export const HELP_KEYWORDS = ["HELP", "INFO", "SUPPORT"] as const

export const START_KEYWORDS = ["START", "YES", "UNSTOP"] as const

function stripBoundaryPunctuation(text: string) {
  return text.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, "").trim()
}

function normalizeInboundText(rawText: string) {
  return stripBoundaryPunctuation(
    rawText
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " "),
  )
}

function matchesKeyword(
  normalizedText: string,
  firstToken: string,
  keywords: readonly string[],
) {
  return keywords.some((keyword) => {
    if (normalizedText === keyword) return true
    return !keyword.includes(" ") && firstToken === keyword
  })
}

export function classifyInboundSms(rawText: string): InboundIntent {
  const normalizedText = normalizeInboundText(rawText)
  if (!normalizedText) return null

  const firstToken = stripBoundaryPunctuation(normalizedText.split(" ")[0] ?? "")

  if (matchesKeyword(normalizedText, firstToken, STOP_KEYWORDS)) return "stop"
  if (matchesKeyword(normalizedText, firstToken, HELP_KEYWORDS)) return "help"
  if (matchesKeyword(normalizedText, firstToken, START_KEYWORDS)) return "start"

  return null
}
