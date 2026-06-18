import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function DesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/websites/${id}/studio`)
}
