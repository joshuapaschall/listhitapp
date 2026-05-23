export interface BrandConfig {
  companyName: string
  tagline: string
  address: string
  colors: { navy: string; orange: string; cream: string; muted: string; divider: string }
  fonts: { heading: string; body: string }
  socials: { facebook?: string; instagram?: string; youtube?: string }
}

export const DEFAULT_BRAND: BrandConfig = {
  companyName: "GA Wholesale Homes",
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
  socials: {
    facebook: "https://",
    instagram: "https://",
    youtube: "https://",
  },
}
