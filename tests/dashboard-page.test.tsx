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
  profit: {
    grossProfit: 0,
    closedCount: 0,
    avgAssignmentFee: 0,
    marketingSpend: 0,
    netProfit: 0,
    marketingRoi: null,
    hasData: false,
  },
  liveDeals: [],
  needsYouToday: {
    unreadReplies: 0,
    offersAwaiting: 0,
    showingsToday: 0,
    followUpsDue: 0,
  },
  funnel: {
    buyers: 10,
    showings: 2,
    offers: 1,
    closed: 0,
  },
  textTrends: { data: [{ date: "2026-06-02", sent: 5, received: 4 }], delta: 0 },
  callTrends: { data: [{ date: "2026-06-02", made: 2, received: 1 }], delta: 0 },
  emailTrends: { data: [{ date: "2026-06-02", sent: 3 }], delta: 0 },
  offerTrends: { data: [{ date: "2026-06-02", created: 1, accepted: 0 }], delta: 0 },
  showingTrends: { data: [{ date: "2026-06-02", scheduled: 0, created: 0 }], delta: 0 },
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
  useSession: () => ({
    session: null,
    user: {
      email: "josh@example.com",
      user_metadata: { full_name: "Josh Buyer" },
    },
    loading: false,
  }),
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

  test("renders the dashboard cockpit", async () => {
    renderPage()

    expect(await screen.findByText(/Good .*Josh/i)).toBeTruthy()
    expect(screen.getByText(/Live deals/i)).toBeTruthy()
    expect(screen.getByText(/Needs you today/i)).toBeTruthy()
    expect(screen.getByText(/Deal pipeline/i)).toBeTruthy()
    expect(screen.getByText(/Activity over time/i)).toBeTruthy()
    expect(screen.getByText(/Profit & performance/i)).toBeTruthy()
    expect(await screen.findByText(/All metrics/i)).toBeTruthy()
    expect(fetch).toHaveBeenCalledWith("/api/dashboard?range=today")
  })

  test("renders channel cards", async () => {
    renderPage()

    expect((await screen.findAllByText(/Email/i)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/SMS/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Calls/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Sent/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Replies/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Voicemails/i)).toBeTruthy()
  })
})
