import { NextRequest, NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { sanitizePostHtml } from "@/lib/blog/sanitize"

type RouteContext = { params: Promise<{ id: string }> }

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
}

// Ensure the slug is unique among this site's non-deleted posts.
async function uniqueSlug(
  supabase: any,
  siteId: string,
  orgId: string,
  base: string,
): Promise<string> {
  const root = base || "post"
  const { data } = await supabase
    .from("posts")
    .select("slug")
    .eq("site_id", siteId)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .ilike("slug", `${root}%`)
  const taken = new Set(((data || []) as Array<{ slug: string }>).map((r) => r.slug))
  if (!taken.has(root)) return root
  let n = 2
  while (taken.has(`${root}-${n}`)) n++
  return `${root}-${n}`
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

  const { id } = await context.params

  try {
    const { data: site } = await supabase.from("sites").select("id").eq("id", id).eq("org_id", orgId).maybeSingle()
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 })

    const body = await request.json()
    const title = (body?.title || "").trim()
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })

    const status = body?.status === "published" ? "published" : "draft"
    const base = body?.slug ? slugify(body.slug) : slugify(title)
    const slug = await uniqueSlug(supabase, id, orgId, base)
    const now = new Date().toISOString()

    const { data: inserted, error } = await supabase
      .from("posts")
      .insert({
        org_id: orgId,
        site_id: id,
        slug,
        title,
        excerpt: body?.excerpt || null,
        body_html: body?.bodyHtml ? sanitizePostHtml(body.bodyHtml) : null,
        featured_image_url: body?.featuredImageUrl || null,
        featured_image_alt: body?.featuredImageAlt || null,
        focus_keyword: body?.focusKeyword || null,
        meta_title: body?.metaTitle || null,
        meta_description: body?.metaDescription || null,
        og_image_url: body?.ogImageUrl || null,
        author_name: body?.authorName || null,
        seo_score: typeof body?.seoScore === "number" ? body.seoScore : null,
        status,
        published_at: status === "published" ? now : null,
      })
      .select("id, slug")
      .single()
    if (error || !inserted) throw error || new Error("Insert failed")

    return NextResponse.json({ id: inserted.id, slug: inserted.slug }, { status: 201 })
  } catch (err) {
    return apiError(err, 500)
  }
}
