"use client"

import MainLayout from "@/components/layout/main-layout"
import { WebsiteStep } from "@/components/onboarding/website-step"

export default function WebsiteStepPage() {
  return (
    <MainLayout>
      <div className="min-h-full bg-muted/40 p-4 sm:p-6">
        <WebsiteStep />
      </div>
    </MainLayout>
  )
}
