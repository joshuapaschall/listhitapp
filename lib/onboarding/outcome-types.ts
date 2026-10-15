// The setup hub's outcome model: 4 required outcomes + 1 optional, every one
// derived from real data. Pure types and derivation — safe on client and
// server. lib/onboarding/outcomes.ts loads the data.

export type OutcomeKey = "business" | "website" | "texting" | "email" | "buyers"

export type OutcomeState = "ready" | "in_review" | "action_needed" | "in_progress" | "not_started"

export interface Outcome {
  key: OutcomeKey
  title: string
  state: OutcomeState
  ready: boolean
  status: string // one-line, plain English, live
  href: string
  optional: boolean
}

export type SetupBanner = "hidden" | "setup" | "texting_review"

export interface SetupSummary {
  outcomes: Outcome[] // required (business, website, texting, email) then buyers
  readyCount: number
  totalCount: number // required outcomes only
  allReady: boolean
  pinned: boolean
  recommended: OutcomeKey | null
  banner: SetupBanner
  firstName: string | null
}

export type TextingStage =
  | "not_started"
  | "awaiting_approval"
  | "submitting"
  | "in_review"
  | "verify_mobile"
  | "action_required"
  | "rejected"
  | "live"

export interface OutcomeData {
  pinned: boolean
  firstName: string | null
  business: { status: "draft" | "ready" | null; hasAnyDetails: boolean }
  website: {
    publishedSiteUrl: string | null
    hasDraftSite: boolean
    websiteUrl: string | null
    privacyUrl: string | null
    termsUrl: string | null
    customDomain: string | null // active custom domain, an optional upgrade
  }
  email: {
    verifiedDomain: string | null
    pendingDomain: string | null
    fromAddress: string | null // a sender on a verified domain
  }
  texting: { stage: TextingStage; phoneNumber: string | null }
  buyers: { count: number }
}

// Recommended order: texting before email because carrier review takes days.
export const REQUIRED_ORDER: OutcomeKey[] = ["business", "website", "texting", "email"]

const TITLES: Record<OutcomeKey, string> = {
  business: "Your business",
  website: "Your website",
  texting: "Texting and calling",
  email: "Email",
  buyers: "Import your buyers",
}

const HREFS: Record<OutcomeKey, string> = {
  business: "/getting-started/business",
  website: "/getting-started/website",
  texting: "/getting-started/texting",
  email: "/getting-started/email",
  buyers: "/buyers",
}

function hostOf(url: string | null): string {
  if (!url) return ""
  try {
    return new URL(url).host
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
  }
}

function formatPhone(e164: string | null): string {
  const m = (e164 || "").match(/^\+1(\d{3})(\d{3})(\d{4})$/)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164 || ""
}

function outcome(key: OutcomeKey, state: OutcomeState, status: string): Outcome {
  return { key, title: TITLES[key], state, ready: state === "ready", status, href: HREFS[key], optional: key === "buyers" }
}

export function textingOutcome(stage: TextingStage, phoneNumber: string | null, pinned: boolean): Outcome {
  if (pinned) return outcome("texting", "ready", "Live (owner phone system)")
  switch (stage) {
    case "live":
      return outcome("texting", "ready", phoneNumber ? `Live · ${formatPhone(phoneNumber)}` : "Live")
    case "awaiting_approval":
    case "submitting":
    case "in_review":
      return outcome("texting", "in_review", "In review · usually a few business days")
    case "verify_mobile":
      return outcome("texting", "action_needed", "Action needed: reply YES to our text")
    case "action_required":
      return outcome("texting", "action_needed", "Action needed: a quick fix and you're back in review")
    case "rejected":
      return outcome("texting", "action_needed", "Action needed: our team will help you finish")
    default:
      return outcome("texting", "not_started", "Not started · get a local number for texts and calls")
  }
}

export function deriveSetupSummary(d: OutcomeData): SetupSummary {
  const business =
    d.business.status === "ready"
      ? outcome("business", "ready", "Business details verified")
      : d.business.hasAnyDetails
        ? outcome("business", "in_progress", "A few details left")
        : outcome("business", "not_started", "Your legal name, address and tax ID")

  const w = d.website
  const hasExternal = Boolean(w.websiteUrl && w.privacyUrl && w.termsUrl)
  const website = w.publishedSiteUrl
    ? outcome("website", "ready", `Live at ${w.customDomain || hostOf(w.publishedSiteUrl)}`)
    : hasExternal
      ? outcome("website", "ready", `Using ${hostOf(w.websiteUrl)}`)
      : w.hasDraftSite
        ? outcome("website", "in_progress", "Your site isn't published yet")
        : outcome("website", "not_started", "A buyer website with the privacy policy carriers require")

  const e = d.email
  const email =
    e.verifiedDomain && e.fromAddress
      ? outcome("email", "ready", `Sending from ${e.fromAddress}`)
      : e.verifiedDomain
        ? outcome("email", "in_progress", "Choose your from address")
        : e.pendingDomain
          ? outcome("email", "in_progress", `Connecting ${e.pendingDomain}`)
          : outcome("email", "not_started", "Send email from your own domain")

  const texting = textingOutcome(d.texting.stage, d.texting.phoneNumber, d.pinned)

  const buyers =
    d.buyers.count > 0
      ? outcome("buyers", "ready", `${d.buyers.count.toLocaleString("en-US")} buyer${d.buyers.count === 1 ? "" : "s"} in your list`)
      : outcome("buyers", "not_started", "Paste a few or upload a spreadsheet")

  const byKey: Record<OutcomeKey, Outcome> = { business, website, texting, email, buyers }
  const required = REQUIRED_ORDER.map((k) => byKey[k])
  const readyCount = required.filter((o) => o.ready).length
  const allReady = readyCount === required.length

  // Next thing to do: the first required outcome that isn't done or waiting on review.
  const recommended = required.find((o) => !o.ready && o.state !== "in_review")?.key ?? null

  const othersReady = required.filter((o) => o.key !== "texting").every((o) => o.ready)
  const banner: SetupBanner =
    d.pinned || allReady ? "hidden" : texting.state === "in_review" && othersReady ? "texting_review" : "setup"

  return {
    outcomes: [...required, buyers],
    readyCount,
    totalCount: required.length,
    allReady,
    pinned: d.pinned,
    recommended,
    banner,
    firstName: d.firstName,
  }
}
