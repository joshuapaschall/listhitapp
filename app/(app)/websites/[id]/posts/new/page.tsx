import MainLayout from "@/components/layout/main-layout"
import { loadOwnedSite } from "@/lib/websites/load-owned-site"
import { SiteHubNav } from "@/components/websites/site-hub-nav"
import { PostEditor } from "@/components/blog/post-editor"

export const dynamic = "force-dynamic"

export default async function NewPostPage({ params }: { params: { id: string } }) {
  const { site, publicUrl } = await loadOwnedSite(params.id, "id,name,slug,status")

  return (
    <MainLayout>
      <div className="space-y-5 p-4 md:p-6">
        <SiteHubNav active="posts" siteId={site.id} siteName={site.name} slug={site.slug} published={site.status === "published"} publicUrl={publicUrl} />
        <PostEditor mode="new" siteId={site.id} siteSlug={site.slug} publicUrl={publicUrl ?? undefined} />
      </div>
    </MainLayout>
  )
}
