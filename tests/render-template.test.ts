import { renderTemplate } from "../lib/utils"
import { splitName } from "../lib/user-context"

describe("renderTemplate", () => {
  test("renders buyer and sender merge tags", () => {
    const rendered = renderTemplate(
      "Hi {{first_name}} {{last_name}} at {{phone}}/{{email}} - {{contact_form_link}} from {{my_first_name}} {{my_last_name}}",
      {
        fname: "Buyer",
        lname: "Person",
        phone: "+15551234567",
        email: "buyer@example.com",
        contact_form_link: "https://example.com/form",
      },
      { myFirstName: "Agent", myLastName: "Smith" },
    )

    expect(rendered).toBe(
      "Hi Buyer Person at +15551234567/buyer@example.com - https://example.com/form from Agent Smith",
    )
  })

  test("falls back to empty sender tags without context", () => {
    const rendered = renderTemplate(
      "Hi {{first_name}} {{last_name}} from {{my_first_name}} {{my_last_name}}",
      { fname: "Buyer", lname: "Person" },
    )

    expect(rendered).toBe("Hi Buyer Person from  ")
  })
})

describe("splitName", () => {
  test.each([
    ["John Smith", { first: "John", last: "Smith" }],
    ["Madonna", { first: "Madonna", last: "" }],
    ["Mary Jane Watson", { first: "Mary", last: "Jane Watson" }],
    [null, { first: "", last: "" }],
  ])("splits %s", (name, expected) => {
    expect(splitName(name)).toEqual(expected)
  })
})
