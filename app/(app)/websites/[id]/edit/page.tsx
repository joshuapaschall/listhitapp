import WebsiteWizard from "@/components/websites/website-wizard"

type RouteContext = { params: Promise<{ id: string }> }

export default async function EditWebsitePage({ params }: RouteContext) {
  const { id } = await params
  return <WebsiteWizard mode="edit" siteId={id} />
}
