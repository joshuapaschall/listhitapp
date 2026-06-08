// Pure, isomorphic SEO scoring for blog posts. No DOM, no React, no framework
// imports — bodyHtml is parsed with regex so it runs identically anywhere.

export type CheckStatus = "pass" | "warn" | "fail"

export interface SeoCheck {
  id: string
  group: "Basics" | "Content" | "Links & media"
  label: string
  status: CheckStatus
  hint?: string
}

export interface SeoResult {
  score: number
  checks: SeoCheck[]
}

export interface SeoInput {
  title: string
  slug: string
  bodyHtml: string
  focusKeyword: string
  metaTitle: string
  metaDescription: string
  featuredImageUrl: string
  featuredImageAlt: string
  excerpt: string
}

// ---- helpers --------------------------------------------------------------

function stripHtml(html: string): string {
  return (html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
}

function wordCount(text: string): number {
  const t = text.trim()
  if (!t) return 0
  return t.split(/\s+/).length
}

function firstParagraphText(html: string): string {
  const m = (html || "").match(/<p[^>]*>([\s\S]*?)<\/p>/i)
  if (m) return stripHtml(m[1])
  // No <p> tags — fall back to the first chunk of plain text.
  return stripHtml(html).slice(0, 400)
}

function headingTexts(html: string): string[] {
  const out: string[] = []
  const re = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html || ""))) out.push(stripHtml(m[1]))
  return out
}

function bodyLinks(html: string): string[] {
  const out: string[] = []
  const re = /<a\s[^>]*href=["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html || ""))) out.push(m[1])
  return out
}

function bodyImages(html: string): string[] {
  return (html || "").match(/<img\b[^>]*>/gi) || []
}

function imageHasAlt(tag: string): boolean {
  const m = tag.match(/\balt=["']([^"']*)["']/i)
  return Boolean(m && m[1].trim())
}

function slugify(input: string): string {
  return (input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

// ---- analyzer -------------------------------------------------------------

export function analyzePost(input: SeoInput): SeoResult {
  const keyword = (input.focusKeyword || "").trim().toLowerCase()
  const hasKeyword = keyword.length > 0
  const plain = stripHtml(input.bodyHtml)
  const plainLower = plain.toLowerCase()
  const words = wordCount(plain)
  const firstPara = firstParagraphText(input.bodyHtml).toLowerCase()
  const headings = headingTexts(input.bodyHtml)
  const headingsLower = headings.map((h) => h.toLowerCase())
  const links = bodyLinks(input.bodyHtml)
  const images = bodyImages(input.bodyHtml)
  const effectiveTitle = (input.metaTitle || input.title || "").trim()
  const metaLen = (input.metaDescription || "").trim().length

  const checks: SeoCheck[] = []
  const add = (
    id: string,
    group: SeoCheck["group"],
    label: string,
    status: CheckStatus,
    hint?: string,
  ) => checks.push({ id, group, label, status, hint })

  // --- Basics ---
  add(
    "focus_keyword_set",
    "Basics",
    "Focus keyword set",
    hasKeyword ? "pass" : "fail",
    hasKeyword ? undefined : "Set a focus keyword",
  )

  const titleLen = effectiveTitle.length
  add(
    "title_length",
    "Basics",
    "Title length",
    titleLen >= 50 && titleLen <= 60
      ? "pass"
      : (titleLen >= 40 && titleLen <= 49) || (titleLen >= 61 && titleLen <= 65)
        ? "warn"
        : "fail",
    titleLen >= 50 && titleLen <= 60 ? undefined : "Aim for 50–60 characters",
  )

  let metaStatus: CheckStatus
  let metaHint: string | undefined
  if (metaLen >= 120 && metaLen <= 158) {
    metaStatus = "pass"
  } else if (metaLen >= 80 && metaLen <= 119) {
    metaStatus = "warn"
    metaHint = "Too short — aim 120–158"
  } else if (metaLen >= 159 && metaLen <= 180) {
    metaStatus = "warn"
    metaHint = "Slightly long"
  } else {
    metaStatus = "fail"
    metaHint = "Add a 120–158 char description"
  }
  add("meta_description_length", "Basics", "Meta description length", metaStatus, metaHint)

  const slugLower = (input.slug || "").toLowerCase()
  const kwTokens = hasKeyword ? slugify(keyword).split("-").filter(Boolean) : []
  const kwInUrl = kwTokens.length > 0 && kwTokens.every((t) => slugLower.includes(t))
  add(
    "keyword_in_url",
    "Basics",
    "Keyword in URL",
    !hasKeyword ? "warn" : kwInUrl ? "pass" : "fail",
    !hasKeyword ? "Set a focus keyword first" : kwInUrl ? undefined : "Add your keyword to the URL",
  )

  // --- Content ---
  add(
    "word_count",
    "Content",
    "Word count",
    words >= 700 ? "pass" : words >= 400 ? "warn" : "fail",
    words >= 700 ? undefined : "Aim for 700+ words",
  )

  add(
    "keyword_in_first_paragraph",
    "Content",
    "Keyword in intro",
    !hasKeyword ? "warn" : firstPara.includes(keyword) ? "pass" : "fail",
    !hasKeyword ? "Set a focus keyword first" : firstPara.includes(keyword) ? undefined : "Mention your keyword early",
  )

  const kwInHeading = hasKeyword && headingsLower.some((h) => h.includes(keyword))
  add(
    "keyword_in_subheading",
    "Content",
    "Keyword in a subheading",
    !hasKeyword ? "warn" : kwInHeading ? "pass" : "fail",
    !hasKeyword ? "Set a focus keyword first" : kwInHeading ? undefined : "Add it to a subheading",
  )

  add(
    "has_subheading",
    "Content",
    "Has a subheading",
    headings.length >= 1 ? "pass" : "warn",
    headings.length >= 1 ? undefined : "Add an H2 to structure the post",
  )

  // --- Links & media ---
  const hasFeatured = (input.featuredImageUrl || "").trim().length > 0
  const featuredAlt = (input.featuredImageAlt || "").trim().length > 0
  add(
    "featured_image",
    "Links & media",
    "Featured image",
    !hasFeatured ? "fail" : featuredAlt ? "pass" : "warn",
    !hasFeatured ? "Add a featured image" : featuredAlt ? undefined : "Add alt text to the featured image",
  )

  const hasInternalLink = links.some((h) => h.startsWith("/") || h.includes("/properties") || h.includes("/blog"))
  add(
    "internal_link",
    "Links & media",
    "Internal link",
    hasInternalLink ? "pass" : "fail",
    hasInternalLink ? undefined : "Link to one of your listings or location pages",
  )

  const missingAlt = images.some((tag) => !imageHasAlt(tag))
  add(
    "image_alt",
    "Links & media",
    "Image alt text",
    missingAlt ? "warn" : "pass",
    missingAlt ? "Some images are missing alt text" : undefined,
  )

  // --- score ---
  const heavy = new Set(["focus_keyword_set", "title_length", "meta_description_length", "word_count"])
  const val: Record<CheckStatus, number> = { pass: 1, warn: 0.5, fail: 0 }
  let earned = 0
  let total = 0
  for (const c of checks) {
    const w = heavy.has(c.id) ? 2 : 1
    total += w
    earned += w * val[c.status]
  }
  const score = total > 0 ? Math.round((100 * earned) / total) : 0

  return { score, checks }
}
