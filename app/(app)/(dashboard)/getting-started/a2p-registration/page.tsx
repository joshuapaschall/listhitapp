"use client"

import MainLayout from "@/components/layout/main-layout"
import { A2pRegistrationForm } from "@/components/onboarding/a2p-registration-form"

export default function A2pRegistrationPage() {
  return (
    <MainLayout>
      <div className="min-h-full bg-muted/40 p-4 sm:p-6">
        <A2pRegistrationForm />
      </div>
    </MainLayout>
  )
}
