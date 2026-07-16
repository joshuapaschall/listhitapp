// Categories of markup whose inner text must never be treated as linkifiable
// body text. Order matters: we stash in this order and restore in reverse so a
// URL living inside a stashed <style>/<script>/comment can never be seen by the
// URL replacement pass.
const PROTECTED_PATTERNS: { prefix: string; regex: RegExp }[] = [
  { prefix: "__LINKIFY_STYLE_", regex: /<style\b[^>]*>[\s\S]*?<\/style>/gi },
  { prefix: "__LINKIFY_SCRIPT_", regex: /<script\b[^>]*>[\s\S]*?<\/script>/gi },
  { prefix: "__LINKIFY_COMMENT_", regex: /<!--[\s\S]*?-->/g },
  { prefix: "__LINKIFY_ANCHOR_", regex: /<a\b[^>]*>[\s\S]*?<\/a>/gi },
]

export function linkifyHtml(html: string): string {
  if (!html) return ""

  const stashes: { prefix: string; matches: string[] }[] = []

  let protectedHtml = html
  for (const { prefix, regex } of PROTECTED_PATTERNS) {
    const matches: string[] = []
    protectedHtml = protectedHtml.replace(regex, (match) => {
      const token = `${prefix}${matches.length}__`
      matches.push(match)
      return token
    })
    stashes.push({ prefix, matches })
  }

  const urlRegex = /(https?:\/\/[\w\-._~:/?#\[\]@!$&'()*+,;=%]+)(?![^<]*>)/g

  const linkified = protectedHtml
    .split(/(<[^>]+>)/g)
    .map((segment) => {
      if (segment.startsWith("<")) {
        return segment
      }
      return segment.replace(urlRegex, (url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
      })
    })
    .join("")

  let restored = linkified
  for (let i = stashes.length - 1; i >= 0; i--) {
    const { prefix, matches } = stashes[i]
    matches.forEach((original, index) => {
      const token = `${prefix}${index}__`
      restored = restored.split(token).join(original)
    })
  }

  return restored
}
