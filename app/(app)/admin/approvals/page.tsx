import MainLayout from "@/components/layout/main-layout"
import { requirePlatformAdminPage } from "../require-platform-admin"
import { ApprovalsList } from "./approvals-list"

export const dynamic = "force-dynamic"

export default async function ApprovalsPage() {
  await requirePlatformAdminPage()
  return (
    <MainLayout>
      <div className="min-h-full bg-muted/40 p-4 sm:p-6">
        <ApprovalsList />
      </div>
    </MainLayout>
  )
}
