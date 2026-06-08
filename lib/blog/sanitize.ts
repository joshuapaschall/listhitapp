// lib/blog/sanitize.ts
//
// Server-side sanitizer for blog post HTML (stored raw from the Tiptap editor).
// Applied on save (authoritative) AND on render (defense-in-depth for any rows
// written before this existed). Pure JS — safe in route handlers and RSC.
import sanitizeHtml from "sanitize-html"

const ALLOWED_TAGS = [
  "p", "br", "hr", "blockquote", "pre", "code", "span",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "strong", "b", "em", "i", "u", "s", "strike", "sub", "sup", "mark",
  "a", "img",
]

export function sanitizePostHtml(html: string): string {
  if (!html) return ""
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      span: ["style"],
      "*": ["class"],
    },
    // Only safe URL schemes; blocks javascript:, data: (except images), etc.
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    // Restrict inline styles to a tiny harmless set (Tiptap text-align etc.).
    allowedStyles: {
      "*": {
        "text-align": [/^(left|right|center|justify)$/],
      },
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer nofollow",
        target: "_blank",
      }),
    },
    // Drop the entire contents of disallowed dangerous tags.
    nonTextTags: ["style", "script", "textarea", "option", "noscript"],
  })
}
