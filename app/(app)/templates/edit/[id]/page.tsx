import { redirect } from "next/navigation"

export default function LegacyEditTemplateRedirect({
  params,
}: {
  params: { id: string }
}) {
  redirect(`/settings/templates/sms/edit/${params.id}`)
}
