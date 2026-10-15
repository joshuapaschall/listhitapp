"use client"

import MainLayout from "@/components/layout/main-layout"
import { EmailStep } from "@/components/onboarding/email-step"

export default function EmailStepPage() {
  return (
    <MainLayout>
      <div className="min-h-full bg-muted/40 p-4 sm:p-6">
        <EmailStep />
      </div>
    </MainLayout>
  )
}
