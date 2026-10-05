// One source of truth for how an organization presents itself to its buyers:
// the name on an email template, the postal address CAN-SPAM requires in every
// marketing email, the contact detail in an SMS HELP reply.
//
// Pure on purpose — no server-only imports — so the client (template previews)
// and the server (campaign sending) format identity identically. A footer that
// renders one way in the builder and another way in the delivered email is a
// compliance problem, not a cosmetic one.

export type OrgIdentityRow = {
  name: string | null
  business_name: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  zip: string | null
  country?: string | null
  phone: string | null
  website_url: string | null
}

export type OrgIdentity = {
  companyName: string
  /** [line1, line2?, "City, ST ZIP"] — compacted and trimmed. */
  addressLines: string[]
  addressSingleLine: string
  /** CAN-SPAM needs a real postal address; a partial one is not usable. */
  hasCompleteAddress: boolean
  phone: string | null
  websiteUrl: string | null
}

export const INCOMPLETE_ADDRESS_MESSAGE =
  "Add your business mailing address in Settings → Organization before sending email. It's legally required in every marketing email."

function clean(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : ""
}

export function orgIdentityFromRow(row: OrgIdentityRow | null | undefined): OrgIdentity {
  const businessName = clean(row?.business_name)
  const name = clean(row?.name)
  const line1 = clean(row?.address_line1)
  const line2 = clean(row?.address_line2)
  const city = clean(row?.city)
  const state = clean(row?.state)
  const zip = clean(row?.zip)

  // "City, ST ZIP" — but don't emit a stray comma when the city is missing.
  const cityStateZip = [city, [state, zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ")

  const addressLines = [line1, line2, cityStateZip].filter(Boolean)

  return {
    companyName: businessName || name || "Your company",
    addressLines,
    addressSingleLine: addressLines.join(", "),
    hasCompleteAddress: Boolean(line1 && city && state && zip),
    phone: clean(row?.phone) || null,
    websiteUrl: clean(row?.website_url) || null,
  }
}
