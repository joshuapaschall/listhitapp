// The one formatter for an org's public identity. The builder preview and the
// delivered email both go through it, so a footer that renders differently in
// the two is a compliance bug, not a cosmetic one.

import { orgIdentityFromRow, INCOMPLETE_ADDRESS_MESSAGE } from "@/lib/org-identity"

const base = {
  name: null,
  business_name: null,
  address_line1: null,
  address_line2: null,
  city: null,
  state: null,
  zip: null,
  phone: null,
  website_url: null,
}

describe("orgIdentityFromRow", () => {
  describe("companyName", () => {
    test("prefers business_name", () => {
      expect(
        orgIdentityFromRow({ ...base, business_name: "Acme LLC", name: "acme-slug" }).companyName,
      ).toBe("Acme LLC")
    })

    test("falls back to name", () => {
      expect(orgIdentityFromRow({ ...base, name: "Acme" }).companyName).toBe("Acme")
    })

    test("falls back to a neutral placeholder, never a real brand", () => {
      expect(orgIdentityFromRow(base).companyName).toBe("Your company")
      expect(orgIdentityFromRow(null).companyName).toBe("Your company")
      expect(orgIdentityFromRow({ ...base, business_name: "   " }).companyName).toBe("Your company")
    })
  })

  describe("addressLines", () => {
    test("compacts and trims", () => {
      const identity = orgIdentityFromRow({
        ...base,
        address_line1: "  1 Main St  ",
        address_line2: "   ",
        city: " Atlanta ",
        state: " GA ",
        zip: " 30301 ",
      })
      expect(identity.addressLines).toEqual(["1 Main St", "Atlanta, GA 30301"])
    })

    test("keeps line2 when present", () => {
      const identity = orgIdentityFromRow({
        ...base,
        address_line1: "1 Main St",
        address_line2: "Suite 200",
        city: "Atlanta",
        state: "GA",
        zip: "30301",
      })
      expect(identity.addressLines).toEqual(["1 Main St", "Suite 200", "Atlanta, GA 30301"])
    })

    test("emits no stray comma when the city is missing", () => {
      const identity = orgIdentityFromRow({
        ...base,
        address_line1: "1 Main St",
        state: "GA",
        zip: "30301",
      })
      expect(identity.addressLines).toEqual(["1 Main St", "GA 30301"])
    })

    test("is empty for a blank row", () => {
      expect(orgIdentityFromRow(base).addressLines).toEqual([])
      expect(orgIdentityFromRow(base).addressSingleLine).toBe("")
    })
  })

  describe("addressSingleLine", () => {
    test("joins the lines with commas", () => {
      const identity = orgIdentityFromRow({
        ...base,
        address_line1: "1 Main St",
        address_line2: "Suite 200",
        city: "Atlanta",
        state: "GA",
        zip: "30301",
      })
      expect(identity.addressSingleLine).toBe("1 Main St, Suite 200, Atlanta, GA 30301")
    })
  })

  describe("hasCompleteAddress", () => {
    const complete = {
      ...base,
      address_line1: "1 Main St",
      city: "Atlanta",
      state: "GA",
      zip: "30301",
    }

    test("true when line1, city, state and zip are all present", () => {
      expect(orgIdentityFromRow(complete).hasCompleteAddress).toBe(true)
    })

    for (const field of ["address_line1", "city", "state", "zip"] as const) {
      test(`false when ${field} is missing`, () => {
        expect(orgIdentityFromRow({ ...complete, [field]: null }).hasCompleteAddress).toBe(false)
      })

      test(`false when ${field} is only whitespace`, () => {
        expect(orgIdentityFromRow({ ...complete, [field]: "   " }).hasCompleteAddress).toBe(false)
      })
    }

    test("line2 is optional", () => {
      expect(
        orgIdentityFromRow({ ...complete, address_line2: null }).hasCompleteAddress,
      ).toBe(true)
    })

    test("false for a null row", () => {
      expect(orgIdentityFromRow(null).hasCompleteAddress).toBe(false)
    })
  })

  describe("contact details", () => {
    test("trims phone and website, or returns null", () => {
      const identity = orgIdentityFromRow({
        ...base,
        phone: "  +14045551212 ",
        website_url: " https://acme.test ",
      })
      expect(identity.phone).toBe("+14045551212")
      expect(identity.websiteUrl).toBe("https://acme.test")

      const blank = orgIdentityFromRow({ ...base, phone: "  ", website_url: "" })
      expect(blank.phone).toBeNull()
      expect(blank.websiteUrl).toBeNull()
    })
  })

  test("the incomplete-address message points at Settings → Organization", () => {
    expect(INCOMPLETE_ADDRESS_MESSAGE).toContain("Settings → Organization")
  })
})
