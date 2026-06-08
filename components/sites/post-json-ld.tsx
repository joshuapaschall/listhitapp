import React from "react"
import type { PostDetail } from "@/lib/site-builder/types"

// Server component: emits BlogPosting/Article structured data for a blog post.
// Only non-null fields are included. Mirrors property-json-ld.tsx.
export function PostJsonLd({ post, host, brandName }: { post: PostDetail; host: string; brandName: string }) {
  const url = `https://${host}/blog/${post.slug}`
  const image = post.featuredImageUrl || post.ogImageUrl

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    mainEntityOfPage: url,
    url,
    author: { "@type": "Person", name: post.authorName || brandName },
    publisher: { "@type": "Organization", name: brandName },
  }
  if (image) data.image = [image]
  if (post.publishedAt) data.datePublished = post.publishedAt
  const description = post.metaDescription || post.excerpt
  if (description) data.description = description

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  )
}
