import { notFound } from "next/navigation"
import MainLayout from "@/components/layout/main-layout"
import { loadOwnedSite } from "@/lib/websites/load-owned-site"
import { SiteHubNav } from "@/components/websites/site-hub-nav"
import { PostEditor, type PostEditorData } from "@/components/blog/post-editor"

export const dynamic = "force-dynamic"

export default async function EditPostPage({ params }: { params: { id: string; postId: string } }) {
  const { supabase, orgId, site, publicUrl } = await loadOwnedSite(params.id, "id,name,slug,status")

  const { data: post } = await supabase
    .from("posts")
    .select("*")
    .eq("id", params.postId)
    .eq("site_id", params.id)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .maybeSingle()
  if (!post) notFound()

  const mapped: PostEditorData = {
    id: post.id,
    title: post.title ?? "",
    slug: post.slug ?? "",
    excerpt: post.excerpt ?? null,
    bodyHtml: post.body_html ?? null,
    featuredImageUrl: post.featured_image_url ?? null,
    featuredImageAlt: post.featured_image_alt ?? null,
    focusKeyword: post.focus_keyword ?? null,
    metaTitle: post.meta_title ?? null,
    metaDescription: post.meta_description ?? null,
    ogImageUrl: post.og_image_url ?? null,
    authorName: post.author_name ?? null,
    status: post.status ?? "draft",
  }

  return (
    <MainLayout>
      <div className="space-y-5 p-4 md:p-6">
        <SiteHubNav active="posts" siteId={site.id} siteName={site.name} slug={site.slug} published={site.status === "published"} publicUrl={publicUrl} />
        <PostEditor mode="edit" siteId={site.id} siteSlug={site.slug} post={mapped} publicUrl={publicUrl ?? undefined} />
      </div>
    </MainLayout>
  )
}
