export function linkifyHtml(html: string): string {
  if (!html) return ""

  const anchorMatches: string[] = []
  const anchorTokenPrefix = "__LINKIFY_ANCHOR_"
  const anchorRegex = /<a\b[^>]*>[\s\S]*?<\/a>/gi

  const protectedHtml = html.replace(anchorRegex, (match) => {
    const token = `${anchorTokenPrefix}${anchorMatches.length}__`
    anchorMatches.push(match)
    return token
  })

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
  anchorMatches.forEach((anchor, index) => {
    const token = `${anchorTokenPrefix}${index}__`
    restored = restored.split(token).join(anchor)
  })

  return restored
}
