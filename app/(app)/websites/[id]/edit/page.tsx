import { redirect } from "next/navigation"

type RouteContext = { params: Promise<{ id: string }> }

export default async function EditWebsitePage({ params }: RouteContext) {
  const { id } = await params
  redirect(`/websites/${id}/studio`)
}
