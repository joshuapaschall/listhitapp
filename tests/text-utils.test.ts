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

  test("replaces extended placeholders", () => {
    const msg =
      "Hi {{first_name}} {{last_name}}, call me at {{phone}} or email {{email}}. {{contact_form_link}} - {{my_first_name}} {{my_last_name}}"
    const out = renderTemplate(
      msg,
      {
        fname: "John",
        lname: "Doe",
        phone: "5551234567",
        email: "john@example.com",
        contact_form_link: "http://example.com/form",
      },
      { myFirstName: "Agent", myLastName: "Smith" },
    )
    expect(out).toBe(
      "Hi John Doe, call me at 5551234567 or email john@example.com. http://example.com/form - Agent Smith",
    )
  })
})
