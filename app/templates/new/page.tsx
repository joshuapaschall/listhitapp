import { redirect } from "next/navigation"

export default function LegacyNewTemplateRedirect() {
  redirect("/settings/templates/sms/new")
}
