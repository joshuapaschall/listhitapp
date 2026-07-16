import { buildCampaignEmail } from "@/lib/email/build-campaign-email"

const UNSUB = "https://app.example.com/api/unsubscribe?id=1&t=2&s=abc"
const ADDRESS = "Acme LLC, 1 Main St, Town, GA 30000"

describe("buildCampaignEmail", () => {
  test("substitutes merge tags in subject and html from buyer + senderContext", () => {
    const built = buildCampaignEmail({
      rawSubject: "Hi {{first_name}} from {{my_first_name}}",
      rawHtml: "<p>Hello {{first_name}} {{last_name}} — from {{my_first_name}} {{my_last_name}}</p>",
      buyer: { fname: "Dana", lname: "Buyer", email: "dana@example.com" },
      senderContext: { myFirstName: "Sam", myLastName: "Seller" },
      unsubscribeUrl: UNSUB,
      physicalAddress: ADDRESS,
    })

    expect(built.subject).toBe("Hi Dana from Sam")
    expect(built.html).toContain("Hello Dana Buyer")
    expect(built.html).toContain("from Sam Seller")
  })

  test("html contains the unsubscribe URL and the physical address", () => {
    const built = buildCampaignEmail({
      rawSubject: "s",
      rawHtml: "<p>body</p>",
      buyer: { fname: "Dana", email: "dana@example.com" },
      unsubscribeUrl: UNSUB,
      physicalAddress: ADDRESS,
    })

    expect(built.html).toContain(UNSUB)
    expect(built.html).toContain(ADDRESS)
  })

  test("text is non-empty, contains the unsubscribe URL, and has no tags", () => {
    const built = buildCampaignEmail({
      rawSubject: "s",
      rawHtml: "<p>body copy</p>",
      buyer: { fname: "Dana", email: "dana@example.com" },
      unsubscribeUrl: UNSUB,
      physicalAddress: ADDRESS,
    })

    expect(built.text.length).toBeGreaterThan(0)
    expect(built.text).toContain(UNSUB)
    expect(built.text).not.toContain("<")
  })

  test("text is derived from the footered html (address ordering guarantee)", () => {
    const built = buildCampaignEmail({
      rawSubject: "s",
      rawHtml: "<p>body</p>",
      buyer: { fname: "Dana", email: "dana@example.com" },
      unsubscribeUrl: UNSUB,
      physicalAddress: ADDRESS,
    })

    // The address only exists because appendUnsubscribeFooter ran BEFORE htmlToText.
    expect(built.text).toContain(ADDRESS)
  })
})
