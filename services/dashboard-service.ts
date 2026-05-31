import { supabase } from "@/lib/supabase"

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

export interface RecentActivityItem {
  id: string
  description: string
  timestamp: string
}

type CountQuery = PromiseLike<{ count: number | null; error: unknown }>
type RowQuery<T> = PromiseLike<{ data: T[] | null; error: unknown }>
type BucketRecord = Record<string, number | string>

type Period = {
  days: number
  periodStart: string
  periodEnd: string
  prevStart: string
  prevEnd: string
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

function getPeriod(range: TimeRange): Period {
  const days = daysForRange(range)
  const periodEndDate = new Date()
  const periodStartDate = new Date(periodEndDate)
  periodStartDate.setDate(periodEndDate.getDate() - days)

  const prevEndDate = new Date(periodStartDate)
  const prevStartDate = new Date(periodStartDate)
  prevStartDate.setDate(periodStartDate.getDate() - days)

  return {
    days,
    periodStart: periodStartDate.toISOString(),
    periodEnd: periodEndDate.toISOString(),
    prevStart: prevStartDate.toISOString(),
    prevEnd: prevEndDate.toISOString(),
  }
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10
}

function percentDelta(curr: number, prev: number) {
  return roundOne(prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100)
}

function rate(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : roundOne((numerator / denominator) * 100)
}

async function readCount(query: CountQuery) {
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

async function readRows<T>(query: RowQuery<T>) {
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

function applyPeriod(query: any, column: string, start: string, end: string) {
  return query.gte(column, start).lt(column, end)
}

function isoDate(timestamp: string | null | undefined) {
  return timestamp ? timestamp.split("T")[0] : null
}

function emptyBuckets<T>(days: number, fields: string[]): T[] {
  const today = new Date()

  return Array.from({ length: days }).map((_, index) => {
    const day = new Date(today)
    day.setDate(today.getDate() - (days - 1 - index))

    const bucket: BucketRecord = { date: day.toISOString().split("T")[0] }
    for (const field of fields) bucket[field] = 0
    return bucket as T
  })
}

function bucketRows<T extends { date: string }>(data: T[], rows: Array<Record<string, any>>, timestampColumn: string, field: string) {
  const byDate = new Map(data.map((item) => [item.date, item]))

  for (const row of rows) {
    const date = isoDate(row[timestampColumn])
    if (!date) continue

    const bucket = byDate.get(date) as BucketRecord | undefined
    if (bucket) bucket[field] = Number(bucket[field] ?? 0) + 1
  }
}

async function countEmailCampaignRecipients(column: string, start: string, end: string) {
  return readCount(
    applyPeriod(
      supabase
        .from("campaign_recipients")
        .select("id, campaigns!inner(channel)", { count: "exact", head: true })
        .eq("campaigns.channel", "email")
        .not(column, "is", null),
      column,
      start,
      end,
    ),
  )
}

export async function fetchKpis(range: TimeRange): Promise<DashboardKpis> {
  const { periodStart, periodEnd, prevStart, prevEnd } = getPeriod(range)

  const [
    buyersAdded,
    buyersAddedPrev,
    totalContacts,
    hotBuyers,
    propertiesAdded,
    activeProperties,
    underContract,
    soldProperties,
    totalProperties,
    campaignsRunning,
    textsSent,
    textsSentPrev,
    textsReceived,
    textsReceivedPrev,
    callsMade,
    callsMadePrev,
    callsReceived,
    callsReceivedPrev,
    voicemailsLeft,
    emailsSent,
    emailsSentPrev,
    emailsOpened,
    emailsClicked,
    emailBounces,
    offersCreated,
    offersCreatedPrev,
    offersAccepted,
    offersAcceptedPrev,
    offersDeclined,
    offersCountered,
    showingsScheduled,
    showingsScheduledPrev,
    showingsRescheduled,
    showingsCancelled,
    showingsCompleted,
    smsUnsubscribes,
    smsUnsubscribesPrev,
    emailUnsubscribes,
    emailUnsubscribesPrev,
  ] = await Promise.all([
    readCount(applyPeriod(supabase.from("buyers").select("*", { count: "exact", head: true }).is("deleted_at", null), "created_at", periodStart, periodEnd)),
    readCount(applyPeriod(supabase.from("buyers").select("*", { count: "exact", head: true }).is("deleted_at", null), "created_at", prevStart, prevEnd)),
    readCount(supabase.from("buyers").select("*", { count: "exact", head: true }).is("deleted_at", null)),
    readCount(supabase.from("buyers").select("*", { count: "exact", head: true }).is("deleted_at", null).eq("vip", true)),
    readCount(applyPeriod(supabase.from("properties").select("*", { count: "exact", head: true }), "created_at", periodStart, periodEnd)),
    readCount(supabase.from("properties").select("*", { count: "exact", head: true }).eq("status", "available")),
    readCount(supabase.from("properties").select("*", { count: "exact", head: true }).eq("status", "under_contract")),
    readCount(supabase.from("properties").select("*", { count: "exact", head: true }).eq("status", "sold")),
    readCount(supabase.from("properties").select("*", { count: "exact", head: true })),
    readCount(supabase.from("campaigns").select("*", { count: "exact", head: true }).in("status", ["pending", "processing"])),
    readCount(applyPeriod(supabase.from("messages").select("*", { count: "exact", head: true }).eq("direction", "outbound").is("deleted_at", null), "created_at", periodStart, periodEnd)),
    readCount(applyPeriod(supabase.from("messages").select("*", { count: "exact", head: true }).eq("direction", "outbound").is("deleted_at", null), "created_at", prevStart, prevEnd)),
    readCount(applyPeriod(supabase.from("messages").select("*", { count: "exact", head: true }).eq("direction", "inbound").is("deleted_at", null), "created_at", periodStart, periodEnd)),
    readCount(applyPeriod(supabase.from("messages").select("*", { count: "exact", head: true }).eq("direction", "inbound").is("deleted_at", null), "created_at", prevStart, prevEnd)),
    readCount(applyPeriod(supabase.from("calls").select("*", { count: "exact", head: true }).eq("direction", "outbound"), "started_at", periodStart, periodEnd)),
    readCount(applyPeriod(supabase.from("calls").select("*", { count: "exact", head: true }).eq("direction", "outbound"), "started_at", prevStart, prevEnd)),
    readCount(applyPeriod(supabase.from("calls").select("*", { count: "exact", head: true }).eq("direction", "inbound"), "started_at", periodStart, periodEnd)),
    readCount(applyPeriod(supabase.from("calls").select("*", { count: "exact", head: true }).eq("direction", "inbound"), "started_at", prevStart, prevEnd)),
    readCount(applyPeriod(supabase.from("calls").select("*", { count: "exact", head: true }).eq("voicemail", true), "started_at", periodStart, periodEnd)),
    countEmailCampaignRecipients("sent_at", periodStart, periodEnd),
    countEmailCampaignRecipients("sent_at", prevStart, prevEnd),
    countEmailCampaignRecipients("opened_at", periodStart, periodEnd),
    countEmailCampaignRecipients("clicked_at", periodStart, periodEnd),
    countEmailCampaignRecipients("bounced_at", periodStart, periodEnd),
    readCount(applyPeriod(supabase.from("offers").select("*", { count: "exact", head: true }), "created_at", periodStart, periodEnd)),
    readCount(applyPeriod(supabase.from("offers").select("*", { count: "exact", head: true }), "created_at", prevStart, prevEnd)),
    readCount(applyPeriod(supabase.from("offers").select("*", { count: "exact", head: true }).not("accepted_at", "is", null), "accepted_at", periodStart, periodEnd)),
    readCount(applyPeriod(supabase.from("offers").select("*", { count: "exact", head: true }).not("accepted_at", "is", null), "accepted_at", prevStart, prevEnd)),
    readCount(applyPeriod(supabase.from("offers").select("*", { count: "exact", head: true }).not("rejected_at", "is", null), "rejected_at", periodStart, periodEnd)),
    readCount(applyPeriod(supabase.from("offers").select("*", { count: "exact", head: true }).not("countered_at", "is", null), "countered_at", periodStart, periodEnd)),
    readCount(applyPeriod(supabase.from("showings").select("*", { count: "exact", head: true }), "created_at", periodStart, periodEnd)),
    readCount(applyPeriod(supabase.from("showings").select("*", { count: "exact", head: true }), "created_at", prevStart, prevEnd)),
    readCount(applyPeriod(supabase.from("showings").select("*", { count: "exact", head: true }).eq("status", "rescheduled"), "updated_at", periodStart, periodEnd)),
    readCount(applyPeriod(supabase.from("showings").select("*", { count: "exact", head: true }).eq("status", "canceled"), "updated_at", periodStart, periodEnd)),
    readCount(applyPeriod(supabase.from("showings").select("*", { count: "exact", head: true }).eq("status", "completed"), "updated_at", periodStart, periodEnd)),
    readCount(applyPeriod(supabase.from("buyers").select("*", { count: "exact", head: true }).not("sms_suppressed_at", "is", null), "sms_suppressed_at", periodStart, periodEnd)),
    readCount(applyPeriod(supabase.from("buyers").select("*", { count: "exact", head: true }).not("sms_suppressed_at", "is", null), "sms_suppressed_at", prevStart, prevEnd)),
    readCount(applyPeriod(supabase.from("buyers").select("*", { count: "exact", head: true }).eq("is_unsubscribed", true).not("unsubscribed_at", "is", null), "unsubscribed_at", periodStart, periodEnd)),
    readCount(applyPeriod(supabase.from("buyers").select("*", { count: "exact", head: true }).eq("is_unsubscribed", true).not("unsubscribed_at", "is", null), "unsubscribed_at", prevStart, prevEnd)),
  ])

  const unsubscribeRate = rate(smsUnsubscribes + emailUnsubscribes, textsSent + emailsSent)
  const prevUnsubscribeRate = rate(smsUnsubscribesPrev + emailUnsubscribesPrev, textsSentPrev + emailsSentPrev)

  return {
    buyersAdded,
    propertiesAdded,
    activeProperties,
    underContract,
    soldProperties,
    totalProperties,
    hotBuyers,
    followUpsDue: 0, // No tasks table in schema — returns 0
    totalContacts,
    textsSent,
    textsSentDelta: percentDelta(textsSent, textsSentPrev),
    textsReceived,
    textsReceivedDelta: percentDelta(textsReceived, textsReceivedPrev),
    callsMade,
    callsMadeDelta: percentDelta(callsMade, callsMadePrev),
    callsReceived,
    callsReceivedDelta: percentDelta(callsReceived, callsReceivedPrev),
    voicemailsLeft,
    emailsSent,
    emailsSentDelta: percentDelta(emailsSent, emailsSentPrev),
    emailsOpened,
    emailBounces,
    openRate: rate(emailsOpened, emailsSent),
    clickRate: rate(emailsClicked, emailsSent),
    bounceRate: rate(emailBounces, emailsSent),
    smsUnsubscribes,
    emailUnsubscribes,
    unsubscribeRate,
    unsubscribeRateDelta: percentDelta(unsubscribeRate, prevUnsubscribeRate),
    campaignsRunning,
    campaignRoi: 0, // No data source in current schema — returns 0
    offersCreated,
    offersCreatedDelta: percentDelta(offersCreated, offersCreatedPrev),
    offersAccepted,
    offersAcceptedDelta: percentDelta(offersAccepted, offersAcceptedPrev),
    offersDeclined,
    offersCountered,
    showingsScheduled,
    showingsScheduledDelta: percentDelta(showingsScheduled, showingsScheduledPrev),
    showingsRescheduled,
    showingsCancelled,
    showingsCompleted,
    grossProfit: 0, // No data source in current schema — returns 0
    netProfit: 0, // No data source in current schema — returns 0
    avgAssignmentFee: 0, // No data source in current schema — returns 0
    closeRate: rate(offersAccepted, offersCreated),
  }
}

export async function fetchTextTrends(range: TimeRange): Promise<TrendWithDelta<TextTrend>> {
  const { days, periodStart, periodEnd, prevStart, prevEnd } = getPeriod(range)
  const data = emptyBuckets<TextTrend>(days, ["sent", "received"])

  const [sentRows, receivedRows, prevSent] = await Promise.all([
    readRows<{ created_at: string }>(applyPeriod(supabase.from("messages").select("created_at").eq("direction", "outbound").is("deleted_at", null), "created_at", periodStart, periodEnd)),
    readRows<{ created_at: string }>(applyPeriod(supabase.from("messages").select("created_at").eq("direction", "inbound").is("deleted_at", null), "created_at", periodStart, periodEnd)),
    readCount(applyPeriod(supabase.from("messages").select("*", { count: "exact", head: true }).eq("direction", "outbound").is("deleted_at", null), "created_at", prevStart, prevEnd)),
  ])

  bucketRows(data, sentRows, "created_at", "sent")
  bucketRows(data, receivedRows, "created_at", "received")

  return { data, delta: percentDelta(sentRows.length, prevSent) }
}

export async function fetchCallTrends(range: TimeRange): Promise<TrendWithDelta<CallTrend>> {
  const { days, periodStart, periodEnd, prevStart, prevEnd } = getPeriod(range)
  const data = emptyBuckets<CallTrend>(days, ["made", "received"])

  const [madeRows, receivedRows, prevMade] = await Promise.all([
    readRows<{ started_at: string }>(applyPeriod(supabase.from("calls").select("started_at").eq("direction", "outbound"), "started_at", periodStart, periodEnd)),
    readRows<{ started_at: string }>(applyPeriod(supabase.from("calls").select("started_at").eq("direction", "inbound"), "started_at", periodStart, periodEnd)),
    readCount(applyPeriod(supabase.from("calls").select("*", { count: "exact", head: true }).eq("direction", "outbound"), "started_at", prevStart, prevEnd)),
  ])

  bucketRows(data, madeRows, "started_at", "made")
  bucketRows(data, receivedRows, "started_at", "received")

  return { data, delta: percentDelta(madeRows.length, prevMade) }
}

export async function fetchEmailTrends(range: TimeRange): Promise<TrendWithDelta<EmailTrend>> {
  const { days, periodStart, periodEnd, prevStart, prevEnd } = getPeriod(range)
  const data = emptyBuckets<EmailTrend>(days, ["sent"])

  const [sentRows, prevSent] = await Promise.all([
    readRows<{ sent_at: string }>(
      applyPeriod(
        supabase
          .from("campaign_recipients")
          .select("sent_at, campaigns!inner(channel)")
          .eq("campaigns.channel", "email")
          .not("sent_at", "is", null),
        "sent_at",
        periodStart,
        periodEnd,
      ),
    ),
    countEmailCampaignRecipients("sent_at", prevStart, prevEnd),
  ])

  bucketRows(data, sentRows, "sent_at", "sent")

  return { data, delta: percentDelta(sentRows.length, prevSent) }
}

export async function fetchOfferTrends(range: TimeRange): Promise<TrendWithDelta<OfferTrend>> {
  const { days, periodStart, periodEnd, prevStart, prevEnd } = getPeriod(range)
  const data = emptyBuckets<OfferTrend>(days, ["created", "accepted"])

  const [createdRows, acceptedRows, prevCreated] = await Promise.all([
    readRows<{ created_at: string }>(applyPeriod(supabase.from("offers").select("created_at"), "created_at", periodStart, periodEnd)),
    readRows<{ accepted_at: string }>(applyPeriod(supabase.from("offers").select("accepted_at").not("accepted_at", "is", null), "accepted_at", periodStart, periodEnd)),
    readCount(applyPeriod(supabase.from("offers").select("*", { count: "exact", head: true }), "created_at", prevStart, prevEnd)),
  ])

  bucketRows(data, createdRows, "created_at", "created")
  bucketRows(data, acceptedRows, "accepted_at", "accepted")

  return { data, delta: percentDelta(createdRows.length, prevCreated) }
}

export async function fetchShowingTrends(range: TimeRange): Promise<TrendWithDelta<ShowingTrend>> {
  const { days, periodStart, periodEnd, prevStart, prevEnd } = getPeriod(range)
  const data = emptyBuckets<ShowingTrend>(days, ["created", "scheduled"])

  const [createdRows, scheduledRows, prevCreated] = await Promise.all([
    readRows<{ created_at: string }>(applyPeriod(supabase.from("showings").select("created_at"), "created_at", periodStart, periodEnd)),
    readRows<{ scheduled_at: string }>(applyPeriod(supabase.from("showings").select("scheduled_at").not("scheduled_at", "is", null), "scheduled_at", periodStart, periodEnd)),
    readCount(applyPeriod(supabase.from("showings").select("*", { count: "exact", head: true }), "created_at", prevStart, prevEnd)),
  ])

  bucketRows(data, createdRows, "created_at", "created")
  bucketRows(data, scheduledRows, "scheduled_at", "scheduled")

  return { data, delta: percentDelta(createdRows.length, prevCreated) }
}

export async function fetchUnsubscribeTrends(range: TimeRange): Promise<TrendWithDelta<UnsubscribeTrend>> {
  const { days, periodStart, periodEnd, prevStart, prevEnd } = getPeriod(range)
  const data = emptyBuckets<UnsubscribeTrend>(days, ["rate"])
  const countsByDate = new Map(data.map((item) => [item.date, { unsubscribes: 0, sends: 0 }]))

  const [smsUnsubRows, emailUnsubRows, textSentRows, emailSentRows, prevSmsUnsubs, prevEmailUnsubs, prevTextsSent, prevEmailsSent] = await Promise.all([
    readRows<{ sms_suppressed_at: string }>(applyPeriod(supabase.from("buyers").select("sms_suppressed_at").not("sms_suppressed_at", "is", null), "sms_suppressed_at", periodStart, periodEnd)),
    readRows<{ unsubscribed_at: string }>(applyPeriod(supabase.from("buyers").select("unsubscribed_at").eq("is_unsubscribed", true).not("unsubscribed_at", "is", null), "unsubscribed_at", periodStart, periodEnd)),
    readRows<{ created_at: string }>(applyPeriod(supabase.from("messages").select("created_at").eq("direction", "outbound").is("deleted_at", null), "created_at", periodStart, periodEnd)),
    readRows<{ sent_at: string }>(
      applyPeriod(
        supabase
          .from("campaign_recipients")
          .select("sent_at, campaigns!inner(channel)")
          .eq("campaigns.channel", "email")
          .not("sent_at", "is", null),
        "sent_at",
        periodStart,
        periodEnd,
      ),
    ),
    readCount(applyPeriod(supabase.from("buyers").select("*", { count: "exact", head: true }).not("sms_suppressed_at", "is", null), "sms_suppressed_at", prevStart, prevEnd)),
    readCount(applyPeriod(supabase.from("buyers").select("*", { count: "exact", head: true }).eq("is_unsubscribed", true).not("unsubscribed_at", "is", null), "unsubscribed_at", prevStart, prevEnd)),
    readCount(applyPeriod(supabase.from("messages").select("*", { count: "exact", head: true }).eq("direction", "outbound").is("deleted_at", null), "created_at", prevStart, prevEnd)),
    countEmailCampaignRecipients("sent_at", prevStart, prevEnd),
  ])

  const addRows = (rows: Array<Record<string, any>>, column: string, field: "unsubscribes" | "sends") => {
    for (const row of rows) {
      const date = isoDate(row[column])
      if (!date) continue

      const counts = countsByDate.get(date)
      if (counts) counts[field] += 1
    }
  }

  addRows(smsUnsubRows, "sms_suppressed_at", "unsubscribes")
  addRows(emailUnsubRows, "unsubscribed_at", "unsubscribes")
  addRows(textSentRows, "created_at", "sends")
  addRows(emailSentRows, "sent_at", "sends")

  for (const item of data) {
    const counts = countsByDate.get(item.date)
    item.rate = counts ? rate(counts.unsubscribes, counts.sends) : 0
  }

  const currentRate = rate(smsUnsubRows.length + emailUnsubRows.length, textSentRows.length + emailSentRows.length)
  const previousRate = rate(prevSmsUnsubs + prevEmailUnsubs, prevTextsSent + prevEmailsSent)

  return { data, delta: percentDelta(currentRate, previousRate) }
}

export async function fetchRecentActivity(_range: TimeRange): Promise<RecentActivityItem[]> {
  const [buyers, offers, messages, showings] = await Promise.all([
    readRows<{ id: string; full_name: string | null; created_at: string }>(
      supabase.from("buyers").select("id, full_name, created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(10),
    ),
    readRows<{ id: string; accepted_at: string | null; created_at: string }>(
      supabase.from("offers").select("id, accepted_at, created_at").order("created_at", { ascending: false }).limit(10),
    ),
    readRows<{ id: string; created_at: string }>(
      supabase.from("messages").select("id, created_at").eq("direction", "inbound").is("deleted_at", null).order("created_at", { ascending: false }).limit(10),
    ),
    readRows<{ id: string; created_at: string }>(
      supabase.from("showings").select("id, created_at").order("created_at", { ascending: false }).limit(10),
    ),
  ])

  const activity: RecentActivityItem[] = [
    ...buyers.map((buyer) => ({
      id: `buyer-${buyer.id}`,
      description: `New buyer added: ${buyer.full_name || "Unknown buyer"}`,
      timestamp: buyer.created_at,
    })),
    ...offers.map((offer) => ({
      id: `offer-${offer.id}`,
      description: offer.accepted_at ? "Offer accepted" : "Offer created",
      timestamp: offer.accepted_at || offer.created_at,
    })),
    ...messages.map((message) => ({
      id: `message-${message.id}`,
      description: "SMS reply received",
      timestamp: message.created_at,
    })),
    ...showings.map((showing) => ({
      id: `showing-${showing.id}`,
      description: "Showing scheduled",
      timestamp: showing.created_at,
    })),
  ]

  return activity
    .filter((item) => item.timestamp)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10)
}
