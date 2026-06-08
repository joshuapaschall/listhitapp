import { supabaseAdmin } from "@/lib/supabase/admin"
import type { PostSummary, PostDetail } from "@/lib/site-builder/types"

// Server-only: public site reads are sessionless, so they MUST use supabaseAdmin
// (anon returns 0 rows under RLS). This lives in its own module so it's never
// pulled into a client bundle (admin.ts throws in the browser). Every query is
// scoped to BOTH site_id AND org_id so a tenant site only shows its own posts.

const SUMMARY_COLUMNS = "id,slug,title,excerpt,featured_image_url,featured_image_alt,published_at"
const DETAIL_COLUMNS =
  "id,slug,title,excerpt,featured_image_url,featured_image_alt,published_at,body_html,meta_title,meta_description,og_image_url,focus_keyword,author_name,seo_score"

interface PostSummaryRow {
  id: string
  slug: string
  title: string
  excerpt: string | null
  featured_image_url: string | null
  featured_image_alt: string | null
  published_at: string | null
}

interface PostDetailRow extends PostSummaryRow {
  body_html: string | null
  meta_title: string | null
  meta_description: string | null
  og_image_url: string | null
  focus_keyword: string | null
  author_name: string | null
  seo_score: number | null
}

function toSummary(r: PostSummaryRow): PostSummary {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    featuredImageUrl: r.featured_image_url,
    featuredImageAlt: r.featured_image_alt,
    publishedAt: r.published_at,
  }
}

export async function getPublishedPosts(
  siteId: string,
  orgId: string,
  limit = 12,
  offset = 0,
): Promise<PostSummary[]> {
  const { data, error } = await supabaseAdmin
    .from("posts")
    .select(SUMMARY_COLUMNS)
    .eq("site_id", siteId)
    .eq("org_id", orgId)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw new Error(error.message)
  return ((data || []) as PostSummaryRow[]).map(toSummary)
}

export async function getPublishedPostCount(siteId: string, orgId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("site_id", siteId)
    .eq("org_id", orgId)
    .eq("status", "published")
    .is("deleted_at", null)
  if (error) throw new Error(error.message)
  return count || 0
}

export async function getPublishedPostBySlug(
  siteId: string,
  orgId: string,
  slug: string,
): Promise<PostDetail | null> {
  const { data, error } = await supabaseAdmin
    .from("posts")
    .select(DETAIL_COLUMNS)
    .eq("site_id", siteId)
    .eq("org_id", orgId)
    .eq("status", "published")
    .is("deleted_at", null)
    .eq("slug", slug)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const r = data as PostDetailRow
  return {
    ...toSummary(r),
    bodyHtml: r.body_html,
    metaTitle: r.meta_title,
    metaDescription: r.meta_description,
    ogImageUrl: r.og_image_url,
    focusKeyword: r.focus_keyword,
    authorName: r.author_name,
    seoScore: r.seo_score,
  }
}
