// Legacy onboarding steps, kept for the onboarding_progress table's history.
// The setup hub no longer reads these — it derives four outcomes from real data
// (lib/onboarding/outcome-types.ts). Pure data + types, safe on client and server.

export type OnboardingStepKey =
  | "profile"
  | "organization"
  | "verify_business"
  | "website"
  | "a2p_registration"
  | "phone_number"
  | "import_buyers"
  | "email_domain"

export type OnboardingSection = "account" | "approval" | "prep"

export type OnboardingStatus = "not_started" | "in_progress" | "done" | "skipped"

export interface OnboardingStepDef {
  key: OnboardingStepKey
  label: string
  description: string
  section: OnboardingSection
  optional: boolean // prep items are optional
  dependsOn: OnboardingStepKey | null // step is "locked" until dependency is done
  href: string | null // navigation target; null = no destination yet (locked items)
  countsTowardProgress: boolean // exclude tour-style/help items
}

export const ONBOARDING_STEPS: OnboardingStepDef[] = [
  {
    key: "profile",
    label: "Set up your profile",
    description: "Your name and contact details.",
    section: "account",
    optional: false,
    dependsOn: null,
    href: null,
    countsTowardProgress: true,
  },
  {
    key: "organization",
    label: "Set up your organization",
    description: "Your business name and address.",
    section: "account",
    optional: false,
    dependsOn: null,
    href: "/settings",
    countsTowardProgress: true,
  },
  {
    key: "verify_business",
    label: "Verify your business",
    description: "EIN or sole proprietor — nobody gets stuck.",
    section: "approval",
    optional: false,
    dependsOn: null,
    href: "/getting-started/verify-business",
    countsTowardProgress: true,
  },
  {
    key: "website",
    label: "Get your website",
    description: "Have one, or build a compliant one in minutes.",
    section: "approval",
    optional: false,
    dependsOn: "verify_business",
    href: "/getting-started/website",
    countsTowardProgress: true,
  },
  {
    key: "a2p_registration",
    label: "Register for texting",
    description: "Carrier review usually takes a few business days. We handle the filing.",
    section: "approval",
    optional: false,
    dependsOn: "website",
    href: "/getting-started/a2p-registration",
    countsTowardProgress: true,
  },
  {
    key: "phone_number",
    label: "Get your phone number",
    description: "Unlocks the moment your registration is approved.",
    section: "approval",
    optional: false,
    dependsOn: "a2p_registration",
    href: null,
    countsTowardProgress: true,
  },
  {
    key: "import_buyers",
    label: "Import your buyers",
    description: "Paste a few to start, or upload a CSV. Finish anytime.",
    section: "prep",
    optional: true,
    dependsOn: null,
    href: "/buyers",
    countsTowardProgress: true,
  },
  {
    key: "email_domain",
    label: "Set up email sending",
    description: "Send email from your own domain so it lands in the inbox.",
    section: "prep",
    optional: true,
    dependsOn: null,
    href: "/settings",
    countsTowardProgress: true,
  },
]

// Steps whose status is derived from organization/profile data, not stored rows.
export const DERIVED_STEP_KEYS: OnboardingStepKey[] = ["profile", "organization"]

export function getStepDef(key: string): OnboardingStepDef | undefined {
  return ONBOARDING_STEPS.find((s) => s.key === key)
}
