// The texting setup page renders by registration stage: confirm details for a
// new registration, the tracker while in review, the reply-YES card, and the
// fix list with links for action needed.

import { render, screen, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/getting-started/texting",
}))

import { TextingStep } from "@/components/onboarding/texting-step"

const BV = {
  entity_type: "ein_business",
  legal_business_name: "Every State House Buyers LLC",
  ein: "12-3456789",
  dba_name: "Every State House Buyers",
  contact_first_name: "Josh",
  contact_last_name: "Paschall",
  contact_email: "josh@example.com",
  ein_letter_path: null,
  business_type: "Limited Liability Corporation",
  rep_title: "Owner",
  rep_job_position: "CEO",
  rep_phone: "+14045550123",
  address_line1: "1 Main St",
  address_line2: "",
  city: "Atlanta",
  state: "GA",
  zip: "30309",
  phone: "+14045550100",
  status: "ready",
  business_name: "Every State House Buyers",
}

const A2P = {
  brand: { legalDisplay: "Every State House Buyers LLC", einMasked: "••-•••6789", address: "1 Main St, Atlanta, GA, 30309", contactName: "Josh Paschall", contactEmail: "josh@example.com", phone: "+14045550100" },
  program: {
    useCaseLabel: "Marketing — property alerts",
    campaignDescription: "Every State House Buyers sends promotional real estate deal alerts to buyers who opt in via our website.",
    messageFlow: "Buyers opt in on the Every State House Buyers signup form at https://esh.listhit.io with unchecked consent boxes.",
    optInUrl: "https://esh.listhit.io",
  },
  brandNames: ["Every State House Buyers", "Every State House Buyers LLC"],
  samples: {
    sample1: "Every State House Buyers: New deal in Atlanta, 3/2 for $180k. Reply STOP to opt out.",
    sample2: "Every State House Buyers: Price drop on Elm St, now $165k. Reply STOP to opt out.",
    sample3: "",
    sample4: "",
    sample5: "",
  },
  status: "ready",
  ready: { verifyReady: true, websiteSet: true },
}

const SETUP = {
  outcomes: [
    { key: "business", title: "Your business", state: "ready", ready: true, status: "Business details verified", href: "/getting-started/business", optional: false },
    { key: "website", title: "Your website", state: "ready", ready: true, status: "Live at esh.listhit.io", href: "/getting-started/website", optional: false },
  ],
  readyCount: 2,
  totalCount: 4,
  allReady: false,
  pinned: false,
  recommended: "texting",
  banner: "setup",
  firstName: "Josh",
}

function statusFor(stage: string, extra: Record<string, unknown> = {}) {
  return {
    stage,
    brandType: "STANDARD",
    phoneNumber: null,
    submittedAt: stage === "not_started" ? null : "2026-10-14T00:00:00Z",
    liveAt: null,
    steps: [
      { key: "business", label: "Business details", state: "done", at: "2026-10-14T01:00:00Z" },
      { key: "brand", label: "Business registration", state: "current" },
      { key: "campaign", label: "Texting program review", state: "waiting" },
      { key: "number", label: "Phone number", state: "waiting" },
    ],
    issues: [],
    canResubmit: false,
    canResendOtp: false,
    reviewCopy: "Usually a few business days",
    ...extra,
  }
}

function mockFetch(status: unknown) {
  global.fetch = vi.fn(async (url: string) => {
    const body = url.startsWith("/api/org-twilio/status")
      ? status
      : url.startsWith("/api/business-verification")
        ? BV
        : url.startsWith("/api/a2p-registration")
          ? A2P
          : url.startsWith("/api/onboarding")
            ? SETUP
            : {}
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } })
  }) as any
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <TextingStep />
    </QueryClientProvider>,
  )
}

const BANNED = /A2P|10DLC|\bTCR\b|Trust ?Hub|TrustProduct|subaccount|campaign/i

describe("texting setup page", () => {
  test("not_started → Screen 1, Confirm your details", async () => {
    mockFetch(statusFor("not_started"))
    renderPage()
    expect(await screen.findByRole("heading", { name: "Confirm your details" })).toBeTruthy()
    expect(screen.getByText("Every State House Buyers LLC")).toBeTruthy()
    expect(screen.getByText("••-•••6789")).toBeTruthy()
    expect(screen.getByText("Privacy and terms included")).toBeTruthy()
    expect(screen.getByText(/#1 reason carriers reject a registration/)).toBeTruthy()
    expect(screen.getByText("See exactly what we'll submit")).toBeTruthy()
    expect(screen.getByRole("button", { name: /Continue/ })).toBeTruthy()
    expect(document.body.textContent).not.toMatch(BANNED)
  })

  test("in_review → tracker with the review pill and the while-you-wait grid", async () => {
    mockFetch(statusFor("in_review"))
    renderPage()
    expect(await screen.findByText("Business verified")).toBeTruthy()
    expect(screen.getByText("Business registration approved")).toBeTruthy()
    expect(screen.getByText("Texting program in review")).toBeTruthy()
    expect(screen.getByText("Your number")).toBeTruthy()
    expect(screen.getAllByText("Usually a few business days").length).toBeGreaterThan(0)
    expect(screen.getByText("While you wait")).toBeTruthy()
    expect(screen.getByText("Import buyers")).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/weeks|7.10 days/)
    expect(document.body.textContent).not.toMatch(BANNED)
  })

  test("verify_mobile → reply-YES card with the masked mobile and resend", async () => {
    mockFetch(statusFor("verify_mobile", { brandType: "SOLE_PROPRIETOR", canResendOtp: true }))
    renderPage()
    expect(await screen.findByText("Reply YES to the text we just sent to (•••) •••-0123")).toBeTruthy()
    expect(screen.getByText("+1 (915) 278-2000")).toBeTruthy()
    expect(screen.getByRole("button", { name: /Resend text/ })).toBeTruthy()
  })

  test("action_required → issues with Fix links to the right step, then Resubmit", async () => {
    mockFetch(
      statusFor("action_required", {
        canResubmit: true,
        issues: [
          { field: "legal_name", message: "Your legal business name must match your IRS EIN letter (CP 575) exactly, including LLC or Inc.", fixable: true },
          { field: "website", message: "Your website needs changes before the carriers will approve it.", fixable: true },
        ],
      }),
    )
    renderPage()
    const first = await screen.findByText(/must match your IRS EIN letter/)
    const row1 = first.closest("li")!
    expect(within(row1).getByRole("link", { name: "Fix" }).getAttribute("href")).toBe("/getting-started/business")
    const row2 = screen.getByText(/Your website needs changes/).closest("li")!
    expect(within(row2).getByRole("link", { name: "Fix" }).getAttribute("href")).toBe("/getting-started/website")
    expect(screen.getByRole("button", { name: "Resubmit" })).toBeTruthy()
  })
})
