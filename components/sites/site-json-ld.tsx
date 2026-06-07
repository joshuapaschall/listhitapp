import type { SiteBusiness } from "@/lib/site-builder/types"

export function SiteJsonLd({ brandName, host, business }: { brandName: string; host: string; business: SiteBusiness }) {
  const sameAs = Object.values(business.social || {}).filter((v): v is string => Boolean(v && v.trim()))
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: brandName,
    url: `https://${host}/`,
  }
  if (business.phone) data.telephone = business.phone
  if (business.email) data.email = business.email
  const addr: Record<string, string> = {}
  if (business.address) addr.streetAddress = business.address
  if (business.city) addr.addressLocality = business.city
  if (business.state) addr.addressRegion = business.state
  if (business.zip) addr.postalCode = business.zip
  if (Object.keys(addr).length > 0) {
    addr["@type"] = "PostalAddress"
    data.address = addr
  }
  if (sameAs.length > 0) data.sameAs = sameAs

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
}
