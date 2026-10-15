"use client"

import MainLayout from "@/components/layout/main-layout"
import { BusinessStep } from "@/components/onboarding/business-step"

export default function BusinessStepPage() {
  return (
    <MainLayout>
      <div className="min-h-full bg-muted/40 p-4 sm:p-6">
        <BusinessStep />
      </div>
    </MainLayout>
  )
}
