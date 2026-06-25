import MainLayout from "@/components/layout/main-layout"
import { loadOwnedSite } from "@/lib/websites/load-owned-site"
import { SiteHubNav } from "@/components/websites/site-hub-nav"
import { PostEditor } from "@/components/blog/post-editor"

export const dynamic = "force-dynamic"

export default async function NewPostPage({ params }: { params: { id: string } }) {
  const { supabase, orgId, site, publicUrl } = await loadOwnedSite(params.id, "id,name,slug,status")

  const { data: catRows } = await supabase
    .from("posts")
    .select("category")
    .eq("site_id", params.id)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .not("category", "is", null)
    .limit(1000)
  const existingCategories = Array.from(
    new Set((catRows || []).map((r: any) => (r.category || "").trim()).filter(Boolean)),
  ).sort()

  return (
    <MainLayout>
      <div className="space-y-5 p-4 md:p-6">
        <SiteHubNav active="posts" siteId={site.id} siteName={site.name} slug={site.slug} published={site.status === "published"} publicUrl={publicUrl} />
        <PostEditor mode="new" siteId={site.id} siteSlug={site.slug} publicUrl={publicUrl ?? undefined} existingCategories={existingCategories} />
      </div>
    </MainLayout>
  )
}
