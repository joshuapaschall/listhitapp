import { describe, test, expect } from "@jest/globals"
import { insertText, renderTemplate } from "../lib/utils"

describe("insertText", () => {
  test("inserts at position", () => {
    const { value, position } = insertText("hello", "😀", 5, 5)
    expect(value).toBe("hello😀")
    expect(position).toBe(7)
  })

  test("replaces selection", () => {
    const { value, position } = insertText("hi there", "{{first_name}}", 3, 8)
    expect(value).toBe("hi {{first_name}}")
    expect(position).toBe(17)
  })
})

describe("renderTemplate", () => {
  test("replaces placeholders with buyer data", () => {
    const msg = "Hi {{first_name}} {{last_name}}"
    const out = renderTemplate(msg, { fname: "John", lname: "Doe" })
    expect(out).toBe("Hi John Doe")
  })

  test("handles missing fields", () => {
    const msg = "Hi {{first_name}}"
    const out = renderTemplate(msg, { fname: null, lname: null })
    expect(out).toBe("Hi ")
  })
})
