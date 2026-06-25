import React from "react"
import type { DealDetail } from "@/lib/site-builder/types"

// Server component: emits structured data for an individual property page.
// Only non-null fields are included. Two graph entries: the residence/listing
// and a breadcrumb trail (Home → City, State → address).
export function PropertyJsonLd({ deal, host, brandName }: { deal: DealDetail; host: string; brandName: string }) {
  const base = `https://${host}`
  const cityState = [deal.city, deal.state].filter(Boolean).join(", ")
  const imageUrls = (deal.images || []).map((i) => i.image_url).filter(Boolean)

  const residence: Record<string, unknown> = {
    "@type": deal.property_type ? "SingleFamilyResidence" : "RealEstateListing",
  }
  if (deal.address) residence.name = deal.address
  if (deal.description) residence.description = deal.description
  if (deal.bedrooms != null) residence.numberOfRooms = deal.bedrooms
  if (deal.year_built != null) residence.yearBuilt = deal.year_built
  if (deal.sqft != null) {
    residence.floorSize = { "@type": "QuantitativeValue", value: deal.sqft, unitCode: "FTK" }
  }
  const address: Record<string, unknown> = { "@type": "PostalAddress" }
  if (deal.address) address.streetAddress = deal.address
  if (deal.city) address.addressLocality = deal.city
  if (deal.state) address.addressRegion = deal.state
  if (deal.zip) address.postalCode = deal.zip
  if (Object.keys(address).length > 1) residence.address = address
  if (imageUrls.length > 0) residence.image = imageUrls
  if (deal.latitude != null && deal.longitude != null) {
    residence.geo = { "@type": "GeoCoordinates", latitude: deal.latitude, longitude: deal.longitude }
  }
  if (deal.price != null) {
    residence.offers = {
      "@type": "Offer",
      price: deal.price,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    }
  }

  const breadcrumbItems: Array<Record<string, unknown>> = [
    { "@type": "ListItem", position: 1, name: brandName || "Home", item: `${base}/` },
  ]
  if (cityState) {
    breadcrumbItems.push({ "@type": "ListItem", position: 2, name: cityState, item: `${base}/properties` })
  }
  if (deal.address) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: breadcrumbItems.length + 1,
      name: deal.address,
      item: `${base}/properties/${deal.slug}`,
    })
  }

  const graphNodes: Array<Record<string, unknown>> = [
    residence,
    { "@type": "BreadcrumbList", itemListElement: breadcrumbItems },
  ]

  if (deal.video_link) {
    const video: Record<string, unknown> = {
      "@type": "VideoObject",
      name: `${deal.address || "Property"} — video tour`,
      description: deal.description || `Video tour of ${deal.address || "this property"}`,
      contentUrl: deal.video_link,
    }
    if (imageUrls.length) video.thumbnailUrl = [imageUrls[0]]
    graphNodes.push(video)
  }

  const graph = {
    "@context": "https://schema.org",
    "@graph": graphNodes,
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  )
}
