// Sanitizer for user-authored 1:1 email bodies (the rich-text composer).
// Keeps the formatting the editor can produce — bold, italic, underline,
// strike, links, lists, quotes, code — and strips everything else. Links are
// limited to http(s) and mailto so a javascript: href can never reach an inbox.
import sanitizeHtml from "sanitize-html"

const ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s", "strike",
  "a", "ul", "ol", "li", "blockquote", "code", "pre", "span",
]

export function sanitizeEmailHtml(html: string): string {
  if (!html) return ""
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ["href"] },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    nonTextTags: ["style", "script", "textarea", "option", "noscript"],
  })
}
