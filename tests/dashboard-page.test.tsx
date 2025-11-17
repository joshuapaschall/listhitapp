/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react"
import DashboardPage from "../app/(dashboard)/dashboard/page"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
// Polyfill ResizeObserver for recharts
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}


jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock("../services/dashboard-service", () => ({
  fetchKpis: jest.fn().mockResolvedValue({
    buyersAdded: 1,
    propertiesAdded: 1,
    activeProperties: 1,
    underContract: 0,
    soldProperties: 0,
    totalProperties: 1,
    hotBuyers: 0,
    followUpsDue: 0,
    totalContacts: 10,
    textsSent: 5,
    textsSentDelta: 0,
    textsReceived: 4,
    textsReceivedDelta: 0,
    callsMade: 2,
    callsMadeDelta: 0,
    callsReceived: 1,
    callsReceivedDelta: 0,
    voicemailsLeft: 0,
    emailsSent: 3,
    emailsSentDelta: 0,
    emailsReceived: 2,
    emailsReceivedDelta: 0,
    emailsOpened: 1,
    emailBounces: 0,
    openRate: 0,
    clickRate: 0,
    bounceRate: 0,
    smsUnsubscribes: 0,
    emailUnsubscribes: 0,
    unsubscribeRate: 0,
    unsubscribeRateDelta: 0,
    campaignsRunning: 1,
    campaignRoi: 50,
    offersCreated: 1,
    offersCreatedDelta: 0,
    offersAccepted: 0,
    offersAcceptedDelta: 0,
    offersDeclined: 0,
    offersCountered: 0,
    showingsScheduled: 0,
    showingsScheduledDelta: 0,
    showingsRescheduled: 0,
    showingsCancelled: 0,
    showingsCompleted: 0,
    grossProfit: 0,
    netProfit: 0,
    avgAssignmentFee: 0,
    closeRate: 0,
  }),
  fetchTextTrends: jest.fn().mockResolvedValue({ data: [], delta: 0 }),
  fetchCallTrends: jest.fn().mockResolvedValue({ data: [], delta: 0 }),
  fetchEmailTrends: jest.fn().mockResolvedValue({ data: [], delta: 0 }),
  fetchOfferTrends: jest.fn().mockResolvedValue({ data: [], delta: 0 }),
  fetchShowingTrends: jest.fn().mockResolvedValue({ data: [], delta: 0 }),
  fetchUnsubscribeTrends: jest.fn().mockResolvedValue({ data: [], delta: 0 }),
  fetchRecentActivity: jest.fn().mockResolvedValue([]),
}))

function renderPage() {
  const qc = new QueryClient()
  render(
    <QueryClientProvider client={qc}>
      <DashboardPage />
    </QueryClientProvider>
  )
}

describe("DashboardPage", () => {
  test("renders KPI sections", async () => {
    renderPage()
    expect(await screen.findByText(/High Level Metrics/i)).toBeTruthy()
    expect(screen.getByText(/Email Metrics/i)).toBeTruthy()
    expect(screen.getByText(/SMS Metrics/i)).toBeTruthy()
    expect(screen.getByText(/Call Metrics/i)).toBeTruthy()
    expect(screen.getByText(/Campaign Metrics/i)).toBeTruthy()
    expect(screen.getByText(/Property Metrics/i)).toBeTruthy()
    expect(screen.getByText(/Showing Metrics/i)).toBeTruthy()
    expect(screen.getByText(/Offer Metrics/i)).toBeTruthy()
    expect(screen.getByText(/Profit & Performance/i)).toBeTruthy()
  })

  test("renders charts", async () => {
    renderPage()
    expect(await screen.findByText(/Performance Trends/i)).toBeTruthy()
    expect(await screen.findByText(/Texts Sent vs. Received/i)).toBeTruthy()
    expect(screen.getByText(/Calls Made vs. Received/i)).toBeTruthy()
    expect(screen.getByText(/Emails Sent vs. Received/i)).toBeTruthy()
    expect(screen.getByText(/Offers Created vs. Accepted/i)).toBeTruthy()
    expect(screen.getByText(/Showings Scheduled vs. Offers Created/i)).toBeTruthy()
    expect(screen.getAllByText(/Unsubscribe Rate/i).length).toBeGreaterThan(0)
  })
})
