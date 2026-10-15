import MainLayout from "@/components/layout/main-layout"
import { sampleEmails } from "@/lib/email/samples"
import { requirePlatformAdminPage } from "../require-platform-admin"
import { EmailPreviews } from "./email-previews"

export const dynamic = "force-dynamic"

export default async function EmailPreviewsPage() {
  await requirePlatformAdminPage()
  return (
    <MainLayout>
      <div className="min-h-full bg-muted/40 p-4 sm:p-6">
        <EmailPreviews emails={sampleEmails()} />
      </div>
    </MainLayout>
  )
}
