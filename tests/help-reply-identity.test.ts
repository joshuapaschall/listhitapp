// A HELP reply is a carrier-compliance message, so it must name the business
// the buyer actually opted in to — not the platform — and fit one SMS segment.

import { buildHelpReply } from "@/lib/sms/inbound-handler"
import { orgIdentityFromRow } from "@/lib/org-identity"

const row = {
  name: "tenant-slug",
  business_name: "Northwind Property Group",
  address_line1: "500 Peachtree St",
  address_line2: null,
  city: "Atlanta",
  state: "GA",
  zip: "30308",
  phone: "+14045551212",
  website_url: "https://northwind.test",
}

describe("buildHelpReply", () => {
  test("names the org and includes its phone", () => {
    const reply = buildHelpReply(orgIdentityFromRow(row))
    expect(reply).toContain("Northwind Property Group")
    expect(reply).toContain("+14045551212")
    expect(reply).toContain("Reply STOP to opt out.")
  })

  test("falls back to the website when there's no phone", () => {
    const reply = buildHelpReply(orgIdentityFromRow({ ...row, phone: null }))
    expect(reply).toContain("https://northwind.test")
  })

  test("omits the contact entirely when there is neither", () => {
    const reply = buildHelpReply(orgIdentityFromRow({ ...row, phone: null, website_url: null }))
    expect(reply).toBe("Northwind Property Group: Msg & data rates may apply. Reply STOP to opt out.")
    expect(reply).not.toContain("Help:")
  })

  test("stays within one SMS segment with a very long company name", () => {
    const reply = buildHelpReply(
      orgIdentityFromRow({
        ...row,
        business_name: "A".repeat(200),
        website_url: `https://${"b".repeat(120)}.test`,
      }),
    )
    expect(reply.length).toBeLessThanOrEqual(160)
    // The name is capped at 40 chars before anything else is added.
    expect(reply.startsWith("A".repeat(40) + ":")).toBe(true)
  })

  test("a null identity gives the generic compliance reply", () => {
    expect(buildHelpReply(null)).toBe("Msg & data rates may apply. Reply STOP to opt out.")
  })

  test("an org with no name at all still gets a usable reply", () => {
    const reply = buildHelpReply(
      orgIdentityFromRow({ ...row, business_name: null, name: null }),
    )
    expect(reply).toContain("Your company")
    expect(reply.length).toBeLessThanOrEqual(160)
  })

  test("never mentions the platform", () => {
    const reply = buildHelpReply(orgIdentityFromRow(row))
    expect(reply).not.toMatch(/ListHit/i)
    expect(reply).not.toMatch(/Georgia Wholesale/i)
  })
})
