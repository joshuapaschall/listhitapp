const NAMED_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
}

function decodeEntities(input: string): string {
  let out = input
  for (const [entity, value] of Object.entries(NAMED_ENTITIES)) {
    out = out.split(entity).join(value)
  }
  // Numeric decimal entities (e.g. &#8202;)
  out = out.replace(/&#(\d+);/g, (_, code) => {
    const num = Number(code)
    return Number.isFinite(num) ? String.fromCodePoint(num) : _
  })
  // Numeric hex entities (e.g. &#x200A;)
  out = out.replace(/&#x([0-9a-f]+);/gi, (_, code) => {
    const num = parseInt(code, 16)
    return Number.isFinite(num) ? String.fromCodePoint(num) : _
  })
  return out
}

function stripTags(input: string): string {
  return input.replace(/<[^>]+>/g, "")
}

export function htmlToText(html: string): string {
  if (!html) return ""

  let out = html

  // Remove <script> and <style> blocks including their contents.
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
  out = out.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")

  // Remove HTML comments (including MSO conditional comments).
  out = out.replace(/<!--[\s\S]*?-->/g, "")

  // Anchors: <a href="URL">TEXT</a> → "TEXT (URL)" (or just the URL / just TEXT).
  out = out.replace(
    /<a\b[^>]*\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s">]+))[^>]*>([\s\S]*?)<\/a>/gi,
    (_match, _raw, dq, sq, bare, inner) => {
      const url = (dq ?? sq ?? bare ?? "").trim()
      const text = stripTags(inner).replace(/\s+/g, " ").trim()
      if (/^(mailto:|tel:)/i.test(url)) {
        return text || url
      }
      if (!url) return text
      if (!text || text === url) return url
      return `${text} (${url})`
    },
  )

  // Line breaks and closing block tags → newlines.
  out = out.replace(/<br\s*\/?>/gi, "\n")
  out = out.replace(/<\/(p|div|tr|h[1-6]|li|table)\s*>/gi, "\n")

  // Strip any remaining tags.
  out = stripTags(out)

  // Decode entities.
  out = decodeEntities(out)

  // Normalize whitespace.
  out = out.replace(/[ \t]+/g, " ")
  out = out
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
  out = out.replace(/\n{3,}/g, "\n\n")

  return out.trim()
}
