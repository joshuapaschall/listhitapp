"use client"

import MainLayout from "@/components/layout/main-layout"
import { VerifyBusinessForm } from "@/components/onboarding/verify-business-form"

export default function VerifyBusinessPage() {
  return (
    <MainLayout>
      <div className="min-h-full bg-muted/40 p-4 sm:p-6">
        <VerifyBusinessForm />
      </div>
    </MainLayout>
  )
}
