import { linkifyHtml } from "../lib/email/linkify-html"

describe("linkifyHtml", () => {
  test("wraps bare URLs in anchor tags", () => {
    const input = "<p>Visit https://example.com</p>"
    const result = linkifyHtml(input)

    expect(result).toContain(
      "<a href=\"https://example.com\" target=\"_blank\" rel=\"noopener noreferrer\">https://example.com</a>",
    )
  })

  test("does not modify existing anchors", () => {
    const input = "<a href='https://example.com'>Example</a>"
    const result = linkifyHtml(input)

    expect(result).toBe(input)
  })
})
