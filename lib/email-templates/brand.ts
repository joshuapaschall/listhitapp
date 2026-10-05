import type { OrgIdentity } from "@/lib/org-identity"

export interface BrandConfig {
  companyName: string
  tagline: string
  address: string
  colors: { navy: string; orange: string; cream: string; muted: string; divider: string }
  fonts: { heading: string; body: string }
  socials: { facebook?: string; instagram?: string; youtube?: string }
}

export const DEFAULT_BRAND: BrandConfig = {
  companyName: "Your company",
  tagline: "Real estate deals for serious buyers",
  address: "[Your business address]",
  colors: {
    navy: "#1E3A8A",
    orange: "#F97316",
    cream: "#F9F7F1",
    muted: "#6B7280",
    divider: "#E5E7EB",
  },
  fonts: {
    heading: "Playfair Display, Georgia, serif",
    body: "Inter, Helvetica, Arial, sans-serif",
  },
  socials: {},
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * The design palette (colors, fonts, tagline) is the product's; the NAME and
 * ADDRESS belong to the tenant. Only overwrite the address placeholder when the
 * org actually has a complete one — otherwise leave it for
 * stampBusinessAddressForCampaign, which substitutes it at send time.
 */
export function brandFromIdentity(identity: OrgIdentity | null): BrandConfig {
  if (!identity) return DEFAULT_BRAND

  return {
    ...DEFAULT_BRAND,
    companyName: identity.companyName,
    address: identity.hasCompleteAddress
      ? identity.addressLines.map(escapeHtml).join("<br/>")
      : DEFAULT_BRAND.address,
  }
}
