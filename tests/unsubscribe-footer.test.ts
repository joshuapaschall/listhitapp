import { appendUnsubscribeFooter } from "../lib/unsubscribe"

const UNSUB = "https://app.example.com/api/unsubscribe?id=1&t=2&s=abc"

describe("appendUnsubscribeFooter", () => {
  test("renders a centered 600px table containing the unsubscribe URL", () => {
    const result = appendUnsubscribeFooter("<body><p>Hi</p></body>", {
      unsubscribeUrl: UNSUB,
      physicalAddress: "Acme LLC, 1 Main St, Town, GA",
    })
    expect(result).toContain('align="center"')
    expect(result).toContain("max-width:600px")
    expect(result).toContain(UNSUB)
  })

  test("inserts before </body> when present", () => {
    const result = appendUnsubscribeFooter("<body><p>Hi</p></body>", {
      unsubscribeUrl: UNSUB,
      physicalAddress: "Acme LLC",
    })
    expect(result.indexOf("unsubscribe here")).toBeLessThan(result.indexOf("</body>"))
  })

  test("appends when no </body> is present", () => {
    const result = appendUnsubscribeFooter("<p>Hi</p>", {
      unsubscribeUrl: UNSUB,
      physicalAddress: "Acme LLC",
    })
    expect(result).toContain("<p>Hi</p>")
    expect(result).toContain("unsubscribe here")
    expect(result.indexOf("<p>Hi</p>")).toBeLessThan(result.indexOf("unsubscribe here"))
  })

  test("escapes an addressLine containing <script>", () => {
    const result = appendUnsubscribeFooter("<body></body>", {
      unsubscribeUrl: UNSUB,
      physicalAddress: '<script>alert("x")</script>',
    })
    expect(result).not.toContain("<script>alert")
    expect(result).toContain("&lt;script&gt;")
  })

  test("throws when physicalAddress is missing", () => {
    expect(() =>
      appendUnsubscribeFooter("<body></body>", { unsubscribeUrl: UNSUB }),
    ).toThrow(/physicalAddress is required/)
  })
})
