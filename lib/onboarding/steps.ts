// Single source of truth for the onboarding flow. Pure data + types — no DB
// access here, so it is safe to import from both server and client code.

export type OnboardingStepKey =
  | "profile"
  | "organization"
  | "verify_business"
  | "website"
  | "a2p_registration"
  | "phone_number"
  | "import_buyers"
  | "connect_gmail"
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
  countsTowardProgress: boolean // exclude tour-style/help items; all 9 below = true
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
    href: null,
    countsTowardProgress: true,
  },
  {
    key: "a2p_registration",
    label: "Register for texting (A2P 10DLC)",
    description: "Carrier review takes about 7–10 days. We handle the filing.",
    section: "approval",
    optional: false,
    dependsOn: "website",
    href: null,
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
    key: "connect_gmail",
    label: "Connect Gmail",
    description: "Optional — send and reply from your inbox.",
    section: "prep",
    optional: true,
    dependsOn: null,
    href: "/gmail",
    countsTowardProgress: true,
  },
  {
    key: "email_domain",
    label: "Authenticate your email domain",
    description: "For email deliverability — add two DNS records.",
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
