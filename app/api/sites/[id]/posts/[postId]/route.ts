import { NextRequest, NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { sanitizePostHtml } from "@/lib/blog/sanitize"

type RouteContext = { params: Promise<{ id: string; postId: string }> }

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
}

async function uniqueSlug(
  supabase: any,
  siteId: string,
  orgId: string,
  base: string,
  excludeId: string,
): Promise<string> {
  const root = base || "post"
  const { data } = await supabase
    .from("posts")
    .select("slug")
    .eq("site_id", siteId)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .neq("id", excludeId)
    .ilike("slug", `${root}%`)
  const taken = new Set(((data || []) as Array<{ slug: string }>).map((r) => r.slug))
  if (!taken.has(root)) return root
  let n = 2
  while (taken.has(`${root}-${n}`)) n++
  return `${root}-${n}`
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

  const { id, postId } = await context.params

  try {
    // Load current row (scoped) to know prior status/published_at.
    const { data: existing } = await supabase
      .from("posts")
      .select("id, status, published_at")
      .eq("id", postId)
      .eq("site_id", id)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const body = await request.json()
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    const map: Record<string, string> = {
      title: "title",
      excerpt: "excerpt",
      bodyHtml: "body_html",
      featuredImageUrl: "featured_image_url",
      featuredImageAlt: "featured_image_alt",
      focusKeyword: "focus_keyword",
      metaTitle: "meta_title",
      metaDescription: "meta_description",
      ogImageUrl: "og_image_url",
      authorName: "author_name",
    }
    for (const [k, col] of Object.entries(map)) {
      if (body[k] !== undefined) {
        updates[col] =
          col === "body_html" && body[k] ? sanitizePostHtml(body[k]) : body[k] || null
      }
    }
    if (typeof body.seoScore === "number") updates.seo_score = body.seoScore

    if (body.slug !== undefined) {
      updates.slug = await uniqueSlug(supabase, id, orgId, slugify(body.slug), postId)
    }

    if (body.status === "published" || body.status === "draft") {
      updates.status = body.status
      if (body.status === "published" && !existing.published_at) {
        updates.published_at = new Date().toISOString()
      }
    }

    const { data: updated, error } = await supabase
      .from("posts")
      .update(updates)
      .eq("id", postId)
      .eq("site_id", id)
      .eq("org_id", orgId)
      .select("id, slug, status")
      .single()
    if (error || !updated) throw error || new Error("Update failed")

    return NextResponse.json(updated)
  } catch (err) {
    return apiError(err, 500)
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

  const { id, postId } = await context.params

  try {
    const { data: updated, error } = await supabase
      .from("posts")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", postId)
      .eq("site_id", id)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle()
    if (error) throw error
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiError(err, 500)
  }
}
