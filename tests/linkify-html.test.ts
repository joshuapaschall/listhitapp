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

  test("leaves a <style> block containing an @import url byte-identical", () => {
    const input = `<style type="text/css">
  @import url(https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap);
</style>`
    const result = linkifyHtml(input)

    expect(result).toBe(input)
    expect(result).not.toContain("<a ")
  })

  test("does not touch a URL inside a <script> block", () => {
    const input = `<script>var u = "https://tracker.example.com/collect";</script>`
    const result = linkifyHtml(input)

    expect(result).toBe(input)
    expect(result).not.toContain("<a ")
  })

  test("does not touch a URL inside an MSO conditional comment", () => {
    const input = `<!--[if mso]><i>https://fonts.googleapis.com/x</i><![endif]-->`
    const result = linkifyHtml(input)

    expect(result).toBe(input)
    expect(result).not.toContain("<a ")
  })

  test("still linkifies a bare URL in body text", () => {
    const input = "<div>See https://deals.example.com/123 now</div>"
    const result = linkifyHtml(input)

    expect(result).toContain(
      "<a href=\"https://deals.example.com/123\" target=\"_blank\" rel=\"noopener noreferrer\">https://deals.example.com/123</a>",
    )
  })

  test("does not double-wrap a URL already inside an anchor", () => {
    const input = `<a href="https://example.com/a">https://example.com/a</a>`
    const result = linkifyHtml(input)

    expect(result).toBe(input)
  })
})
