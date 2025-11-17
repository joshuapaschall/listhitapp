export type TimeRange = "today" | "week" | "month"

export interface DashboardKpis {
  buyersAdded: number
  propertiesAdded: number
  activeProperties: number
  underContract: number
  soldProperties: number
  totalProperties: number
  hotBuyers: number
  followUpsDue: number
  totalContacts: number
  textsSent: number
  textsSentDelta: number
  textsReceived: number
  textsReceivedDelta: number
  callsMade: number
  callsMadeDelta: number
  callsReceived: number
  callsReceivedDelta: number
  voicemailsLeft: number
  emailsSent: number
  emailsSentDelta: number
  emailsReceived: number
  emailsReceivedDelta: number
  emailsOpened: number
  emailBounces: number
  openRate: number
  clickRate: number
  bounceRate: number
  smsUnsubscribes: number
  emailUnsubscribes: number
  unsubscribeRate: number
  unsubscribeRateDelta: number
  campaignsRunning: number
  campaignRoi: number
  offersCreated: number
  offersCreatedDelta: number
  offersAccepted: number
  offersAcceptedDelta: number
  offersDeclined: number
  offersCountered: number
  showingsScheduled: number
  showingsScheduledDelta: number
  showingsRescheduled: number
  showingsCancelled: number
  showingsCompleted: number
  grossProfit: number
  netProfit: number
  avgAssignmentFee: number
  closeRate: number
}

export async function fetchKpis(_range: TimeRange): Promise<DashboardKpis> {
  // TODO: replace mock data with real Supabase queries
  return {
    buyersAdded: 5,
    propertiesAdded: 2,
    activeProperties: 10,
    underContract: 3,
    soldProperties: 5,
    totalProperties: 20,
    hotBuyers: 3,
    followUpsDue: 4,
    totalContacts: 1500,
    textsSent: 40,
    textsSentDelta: 5,
    textsReceived: 32,
    textsReceivedDelta: -3,
    callsMade: 8,
    callsMadeDelta: 2,
    callsReceived: 6,
    callsReceivedDelta: -1,
    voicemailsLeft: 2,
    emailsSent: 12,
    emailsSentDelta: 4,
    emailsReceived: 10,
    emailsReceivedDelta: -2,
    emailsOpened: 7,
    emailBounces: 1,
    openRate: 58,
    clickRate: 12,
    bounceRate: 4,
    smsUnsubscribes: 1,
    emailUnsubscribes: 2,
    unsubscribeRate: 3,
    unsubscribeRateDelta: 0.5,
    campaignsRunning: 2,
    campaignRoi: 150,
    offersCreated: 3,
    offersCreatedDelta: 6,
    offersAccepted: 1,
    offersAcceptedDelta: -1,
    offersDeclined: 1,
    offersCountered: 1,
    showingsScheduled: 4,
    showingsScheduledDelta: -2,
    showingsRescheduled: 1,
    showingsCancelled: 1,
    showingsCompleted: 2,
    grossProfit: 12000,
    netProfit: 8000,
    avgAssignmentFee: 5000,
    closeRate: 33,
  }
}

export interface TrendWithDelta<T> {
  data: T[]
  delta: number
}

export interface TextTrend {
  date: string
  sent: number
  received: number
}

export interface CallTrend {
  date: string
  made: number
  received: number
}

export interface EmailTrend {
  date: string
  sent: number
  received: number
}

export interface OfferTrend {
  date: string
  created: number
  accepted: number
}

export interface ShowingTrend {
  date: string
  scheduled: number
  created: number
}

export interface UnsubscribeTrend {
  date: string
  rate: number
}

function daysForRange(range: TimeRange) {
  switch (range) {
    case "today":
      return 1
    case "month":
      return 30
    default:
      return 7
  }
}

function generateTrends(range: TimeRange, fields: string[]): TrendWithDelta<any> {
  const days = daysForRange(range)
  const today = new Date()
  const data = Array.from({ length: days }).map((_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (days - 1 - i))
    const entry: any = { date: d.toISOString().split("T")[0] }
    for (const f of fields) entry[f] = Math.floor(Math.random() * 20) + 5
    return entry
  })
  const currentTotal = data.reduce((sum, item) => sum + item[fields[0]], 0)
  const prevTotal = Math.floor(currentTotal * (Math.random() * 0.4 + 0.8))
  const delta = prevTotal ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0
  return { data, delta }
}

export async function fetchTextTrends(range: TimeRange): Promise<TrendWithDelta<TextTrend>> {
  return generateTrends(range, ["sent", "received"])
}

export async function fetchCallTrends(range: TimeRange): Promise<TrendWithDelta<CallTrend>> {
  return generateTrends(range, ["made", "received"])
}

export async function fetchEmailTrends(range: TimeRange): Promise<TrendWithDelta<EmailTrend>> {
  return generateTrends(range, ["sent", "received"])
}

export async function fetchOfferTrends(range: TimeRange): Promise<TrendWithDelta<OfferTrend>> {
  return generateTrends(range, ["created", "accepted"])
}

export async function fetchShowingTrends(range: TimeRange): Promise<TrendWithDelta<ShowingTrend>> {
  return generateTrends(range, ["scheduled", "created"])
}

export async function fetchUnsubscribeTrends(range: TimeRange): Promise<TrendWithDelta<UnsubscribeTrend>> {
  return generateTrends(range, ["rate"])
}

export interface RecentActivityItem {
  id: string
  description: string
  timestamp: string
}

export async function fetchRecentActivity(_range: TimeRange): Promise<RecentActivityItem[]> {
  const now = new Date().toISOString()
  return [
    { id: "1", description: "New buyer added", timestamp: now },
    { id: "2", description: "Offer accepted on Maple St", timestamp: now },
    { id: "3", description: "SMS reply from Jane", timestamp: now },
  ]
}
