"use client"

import MainLayout from "@/components/layout/main-layout"
import { TextingStep } from "@/components/onboarding/texting-step"

export default function TextingStepPage() {
  return (
    <MainLayout>
      <div className="min-h-full bg-muted/40 p-4 sm:p-6">
        <TextingStep />
      </div>
    </MainLayout>
  )
}
