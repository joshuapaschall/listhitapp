// The regression this guards: every fully-designed template used to bake
// "GA Wholesale Homes" into its logo alt text and footer, so a different
// tenant's buyers saw the platform operator's brand in their inbox.

import { FULLY_DESIGNED_TEMPLATES } from "@/lib/email-templates"
import { brandFromIdentity, DEFAULT_BRAND } from "@/lib/email-templates/brand"
import { orgIdentityFromRow } from "@/lib/org-identity"

const identity = orgIdentityFromRow({
  name: "tenant-slug",
  business_name: "Northwind Property Group",
  address_line1: "500 Peachtree St",
  address_line2: "Suite 12",
  city: "Atlanta",
  state: "GA",
  zip: "30308",
  phone: "+14045551212",
  website_url: "https://northwind.test",
})

const fullyDesigned = FULLY_DESIGNED_TEMPLATES

describe("fully-designed email templates carry the org's brand", () => {
  test("there are templates to check", () => {
    expect(fullyDesigned.length).toBeGreaterThan(0)
  })

  for (const template of fullyDesigned) {
    describe(template.id, () => {
      const rendered = JSON.stringify(template.build(brandFromIdentity(identity)))

      test("contains the org's company name", () => {
        expect(rendered).toContain("Northwind Property Group")
      })

      test("contains no trace of the platform operator's brand", () => {
        expect(rendered).not.toMatch(/GA Wholesale/i)
        expect(rendered).not.toMatch(/Georgia Wholesale/i)
      })

      test("renders the org's address in the footer", () => {
        expect(rendered).toContain("500 Peachtree St")
        expect(rendered).toContain("Atlanta, GA 30308")
      })
    })
  }

  test("builds with no brand at all (preview with no org context)", () => {
    for (const template of fullyDesigned) {
      const rendered = JSON.stringify(template.build())
      expect(rendered).toContain(DEFAULT_BRAND.companyName)
      expect(rendered).not.toMatch(/GA Wholesale/i)
    }
  })
})

describe("brandFromIdentity", () => {
  test("keeps the design palette and swaps name + address", () => {
    const brand = brandFromIdentity(identity)
    expect(brand.companyName).toBe("Northwind Property Group")
    expect(brand.address).toBe("500 Peachtree St<br/>Suite 12<br/>Atlanta, GA 30308")
    expect(brand.colors).toEqual(DEFAULT_BRAND.colors)
    expect(brand.fonts).toEqual(DEFAULT_BRAND.fonts)
    expect(brand.tagline).toBe(DEFAULT_BRAND.tagline)
  })

  test("leaves the stamping placeholder when the address is incomplete", () => {
    const partial = orgIdentityFromRow({
      name: null,
      business_name: "Half Address Co",
      address_line1: "1 Main St",
      address_line2: null,
      city: null,
      state: null,
      zip: null,
      phone: null,
      website_url: null,
    })
    const brand = brandFromIdentity(partial)
    expect(brand.companyName).toBe("Half Address Co")
    // stampBusinessAddressForCampaign substitutes this at send time.
    expect(brand.address).toBe(DEFAULT_BRAND.address)
  })

  test("escapes HTML in the address", () => {
    const nasty = orgIdentityFromRow({
      name: null,
      business_name: "Acme",
      address_line1: '1 "Main" <b>St</b>',
      address_line2: null,
      city: "Atlanta",
      state: "GA",
      zip: "30301",
      phone: null,
      website_url: null,
    })
    const brand = brandFromIdentity(nasty)
    expect(brand.address).not.toContain("<b>")
    expect(brand.address).toContain("&lt;b&gt;")
  })

  test("a null identity returns the default brand untouched", () => {
    expect(brandFromIdentity(null)).toEqual(DEFAULT_BRAND)
  })
})
