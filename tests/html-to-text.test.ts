import { htmlToText } from "../lib/email/html-to-text"

describe("htmlToText", () => {
  test("anchor renders as TEXT (URL)", () => {
    const result = htmlToText('<a href="https://example.com/deal">View deal</a>')
    expect(result).toBe("View deal (https://example.com/deal)")
  })

  test("anchor whose text equals the URL emits the URL once", () => {
    const result = htmlToText('<a href="https://example.com">https://example.com</a>')
    expect(result).toBe("https://example.com")
  })

  test("mailto anchor skips the parenthetical", () => {
    const result = htmlToText('<a href="mailto:hi@example.com">Email us</a>')
    expect(result).toBe("Email us")
  })

  test("removes <style> and <script> blocks", () => {
    const input =
      '<style>.a{color:red}</style><script>alert("x")</script><p>Hello</p>'
    expect(htmlToText(input)).toBe("Hello")
  })

  test("removes MSO conditional comments", () => {
    const input = "<!--[if mso]><p>hidden</p><![endif]--><p>Shown</p>"
    expect(htmlToText(input)).toBe("Shown")
  })

  test("decodes &nbsp; and &#8202;", () => {
    const result = htmlToText("<p>A&nbsp;B&#8202;C</p>")
    expect(result).toBe("A B C")
  })

  test("collapses 3+ newlines to 2", () => {
    const input = "<p>One</p><br><br><br><br><p>Two</p>"
    const result = htmlToText(input)
    expect(result).toBe("One\n\nTwo")
    expect(result).not.toMatch(/\n{3,}/)
  })

  test("returns empty string for empty input", () => {
    expect(htmlToText("")).toBe("")
    expect(htmlToText(undefined as unknown as string)).toBe("")
  })
})
