/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import DashboardPage from "../app/(dashboard)/dashboard/page"

// Polyfill ResizeObserver for recharts
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const dashboardPayload = {
  kpis: {
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
  },
  textTrends: { data: [], delta: 0 },
  callTrends: { data: [], delta: 0 },
  emailTrends: { data: [], delta: 0 },
  offerTrends: { data: [], delta: 0 },
  showingTrends: { data: [], delta: 0 },
  unsubscribeTrends: { data: [], delta: 0 },
  recentActivity: [],
}

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/lib/supabase-browser", () => ({
  __esModule: true,
  supabaseBrowser: vi.fn(() => ({
    from: vi.fn(),
  })),
}))

vi.mock("../lib/supabase-browser", () => ({
  __esModule: true,
  supabaseBrowser: vi.fn(() => ({
    from: vi.fn(),
  })),
}))

vi.mock("@/components/voice/CallProvider", () => ({
  CallProvider: ({ children }: any) => children,
  useCall: () => new Proxy({}, { get: () => () => {} }),
}))

vi.mock("@/hooks/use-notifications", () => ({
  NotificationsProvider: ({ children }: any) => children,
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    markAsRead: vi.fn().mockResolvedValue(undefined),
    dismiss: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock("@/hooks/use-session", () => ({
  SessionProvider: ({ children }: any) => children,
  useSession: () => ({ session: null, user: null, loading: false }),
}))

vi.mock("../lib/supabase", () => {
  const channel: any = { on: () => channel, subscribe: () => channel }
  const client = {
    channel: () => channel,
    removeChannel: vi.fn(),
    from: () => ({
      select: () => ({
        eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
      }),
    }),
  }
  return { __esModule: true, supabase: client, supabaseAdmin: client }
})

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(dashboardPayload),
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function renderPage() {
    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <DashboardPage />
      </QueryClientProvider>,
    )
  }

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
    expect(fetch).toHaveBeenCalledWith("/api/dashboard?range=today")
  })

  test("renders charts", async () => {
    renderPage()
    expect(await screen.findByText(/Performance Trends/i)).toBeTruthy()
    expect(await screen.findByText(/Texts Sent vs. Received/i)).toBeTruthy()
    expect(screen.getByText(/Calls Made vs. Received/i)).toBeTruthy()
    expect(screen.getAllByText(/Emails Sent/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Offers Created vs. Accepted/i)).toBeTruthy()
    expect(screen.getByText(/Showings Scheduled vs. Offers Created/i)).toBeTruthy()
    expect(screen.getAllByText(/Unsubscribe Rate/i).length).toBeGreaterThan(0)
  })
})
