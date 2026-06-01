import type { SupabaseClient } from "@supabase/supabase-js"

export type TimeRange = "today" | "week" | "month"

export interface DashboardKpis {
  buyersAdded: number
  buyersAddedDelta: number
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

export interface DashboardProfit {
  grossProfit: number
  closedCount: number
  avgAssignmentFee: number
  marketingSpend: number
  netProfit: number
  marketingRoi: number | null
  hasData: boolean
}

export interface LiveDeal {
  id: string
  address: string | null
  city: string | null
  state: string | null
  status: string | null
  createdAt: string
  daysOnMarket: number
  offerCount: number
}

export interface NeedsYouToday {
  unreadReplies: number
  offersAwaiting: number
  showingsToday: number
  followUpsDue: number
}

export interface DealFunnel {
  buyers: number
  showings: number
  offers: number
  closed: number
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

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0)
}

function unique<T>(values: T[]) {
  return [...new Set(values)]
}

function getDatePartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)

  const getPart = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: getPart("hour"),
    minute: getPart("minute"),
    second: getPart("second"),
  }
}

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getDatePartsInTimeZone(date, timeZone)
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return asUtc - date.getTime()
}

function zonedDateTimeToUtc(year: number, month: number, day: number, timeZone: string) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0))
  const firstUtc = new Date(utcGuess.getTime() - timeZoneOffsetMs(utcGuess, timeZone))
  const secondUtc = new Date(utcGuess.getTime() - timeZoneOffsetMs(firstUtc, timeZone))
  return secondUtc
}

function getTodayBounds() {
  const timeZone = process.env.APP_TIMEZONE || "America/New_York"
  const today = getDatePartsInTimeZone(new Date(), timeZone)
  const start = zonedDateTimeToUtc(today.year, today.month, today.day, timeZone)
  const tomorrow = new Date(start)
  tomorrow.setUTCDate(start.getUTCDate() + 1)

  return {
    startIso: start.toISOString(),
    endIso: tomorrow.toISOString(),
    todayDate: `${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`,
  }
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

  return new Array(days).fill(null).map((_, index) => {
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

async function countEmailCampaignRecipients(client: SupabaseClient, orgId: string, column: string, start: string, end: string) {
  return readCount(
    applyPeriod(
      client
        .from("campaign_recipients")
        .select("id, campaigns!inner(channel)", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("campaigns.channel", "email")
        .not(column, "is", null),
      column,
      start,
      end,
    ),
  )
}

export async function fetchKpis(range: TimeRange, orgId: string, client: SupabaseClient): Promise<DashboardKpis> {
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
    readCount(applyPeriod(client.from("buyers").select("*", { count: "exact", head: true }).eq("org_id", orgId).is("deleted_at", null), "created_at", periodStart, periodEnd)),
    readCount(applyPeriod(client.from("buyers").select("*", { count: "exact", head: true }).eq("org_id", orgId).is("deleted_at", null), "created_at", prevStart, prevEnd)),
    readCount(client.from("buyers").select("*", { count: "exact", head: true }).eq("org_id", orgId).is("deleted_at", null)),
    readCount(client.from("buyers").select("*", { count: "exact", head: true }).eq("org_id", orgId).is("deleted_at", null).eq("vip", true)),
    readCount(applyPeriod(client.from("properties").select("*", { count: "exact", head: true }).eq("org_id", orgId), "created_at", periodStart, periodEnd)),
    readCount(client.from("properties").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "available")),
    readCount(client.from("properties").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "under_contract")),
    readCount(client.from("properties").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "sold")),
    readCount(client.from("properties").select("*", { count: "exact", head: true }).eq("org_id", orgId)),
    readCount(client.from("campaigns").select("*", { count: "exact", head: true }).eq("org_id", orgId).in("status", ["pending", "processing"])),
    readCount(applyPeriod(client.from("messages").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("direction", "outbound").is("deleted_at", null), "created_at", periodStart, periodEnd)),
    readCount(applyPeriod(client.from("messages").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("direction", "outbound").is("deleted_at", null), "created_at", prevStart, prevEnd)),
    readCount(applyPeriod(client.from("messages").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("direction", "inbound").is("deleted_at", null), "created_at", periodStart, periodEnd)),
    readCount(applyPeriod(client.from("messages").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("direction", "inbound").is("deleted_at", null), "created_at", prevStart, prevEnd)),
    readCount(applyPeriod(client.from("calls").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("direction", "outbound"), "started_at", periodStart, periodEnd)),
    readCount(applyPeriod(client.from("calls").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("direction", "outbound"), "started_at", prevStart, prevEnd)),
    readCount(applyPeriod(client.from("calls").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("direction", "inbound"), "started_at", periodStart, periodEnd)),
    readCount(applyPeriod(client.from("calls").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("direction", "inbound"), "started_at", prevStart, prevEnd)),
    readCount(applyPeriod(client.from("calls").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("voicemail", true), "started_at", periodStart, periodEnd)),
    countEmailCampaignRecipients(client, orgId, "sent_at", periodStart, periodEnd),
    countEmailCampaignRecipients(client, orgId, "sent_at", prevStart, prevEnd),
    countEmailCampaignRecipients(client, orgId, "opened_at", periodStart, periodEnd),
    countEmailCampaignRecipients(client, orgId, "clicked_at", periodStart, periodEnd),
    countEmailCampaignRecipients(client, orgId, "bounced_at", periodStart, periodEnd),
    readCount(applyPeriod(client.from("offers").select("*", { count: "exact", head: true }).eq("org_id", orgId), "created_at", periodStart, periodEnd)),
    readCount(applyPeriod(client.from("offers").select("*", { count: "exact", head: true }).eq("org_id", orgId), "created_at", prevStart, prevEnd)),
    readCount(applyPeriod(client.from("offers").select("*", { count: "exact", head: true }).eq("org_id", orgId).not("accepted_at", "is", null), "accepted_at", periodStart, periodEnd)),
    readCount(applyPeriod(client.from("offers").select("*", { count: "exact", head: true }).eq("org_id", orgId).not("accepted_at", "is", null), "accepted_at", prevStart, prevEnd)),
    readCount(applyPeriod(client.from("offers").select("*", { count: "exact", head: true }).eq("org_id", orgId).not("rejected_at", "is", null), "rejected_at", periodStart, periodEnd)),
    readCount(applyPeriod(client.from("offers").select("*", { count: "exact", head: true }).eq("org_id", orgId).not("countered_at", "is", null), "countered_at", periodStart, periodEnd)),
    readCount(applyPeriod(client.from("showings").select("*", { count: "exact", head: true }).eq("org_id", orgId), "created_at", periodStart, periodEnd)),
    readCount(applyPeriod(client.from("showings").select("*", { count: "exact", head: true }).eq("org_id", orgId), "created_at", prevStart, prevEnd)),
    readCount(applyPeriod(client.from("showings").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "rescheduled"), "updated_at", periodStart, periodEnd)),
    readCount(applyPeriod(client.from("showings").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "canceled"), "updated_at", periodStart, periodEnd)),
    readCount(applyPeriod(client.from("showings").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "completed"), "updated_at", periodStart, periodEnd)),
    readCount(applyPeriod(client.from("buyers").select("*", { count: "exact", head: true }).eq("org_id", orgId).not("sms_suppressed_at", "is", null), "sms_suppressed_at", periodStart, periodEnd)),
    readCount(applyPeriod(client.from("buyers").select("*", { count: "exact", head: true }).eq("org_id", orgId).not("sms_suppressed_at", "is", null), "sms_suppressed_at", prevStart, prevEnd)),
    readCount(applyPeriod(client.from("buyers").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("is_unsubscribed", true).not("unsubscribed_at", "is", null), "unsubscribed_at", periodStart, periodEnd)),
    readCount(applyPeriod(client.from("buyers").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("is_unsubscribed", true).not("unsubscribed_at", "is", null), "unsubscribed_at", prevStart, prevEnd)),
  ])

  const unsubscribeRate = rate(smsUnsubscribes + emailUnsubscribes, textsSent + emailsSent)
  const prevUnsubscribeRate = rate(smsUnsubscribesPrev + emailUnsubscribesPrev, textsSentPrev + emailsSentPrev)

  return {
    buyersAdded,
    buyersAddedDelta: percentDelta(buyersAdded, buyersAddedPrev),
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

export async function fetchProfitMetrics(range: TimeRange, orgId: string, client: SupabaseClient): Promise<DashboardProfit> {
  const { periodStart, periodEnd } = getPeriod(range)
  const closingStart = periodStart.split("T")[0]
  const closingEnd = periodEnd.split("T")[0]

  const dispositions = await readRows<{
    property_id: string | null
    buy_price: number | string | null
    sale_price: number | string | null
    assignment_fee: number | string | null
    rehab_budget: number | string | null
    closing_expenses: number | string | null
  }>(
    applyPeriod(
      client
        .from("dispositions")
        .select("property_id, buy_price, sale_price, assignment_fee, rehab_budget, closing_expenses")
        .eq("org_id", orgId)
        .eq("sale_status", "closed")
        .not("closing_date", "is", null),
      "closing_date",
      closingStart,
      closingEnd,
    ),
  )

  const closedCount = dispositions.length
  const grossProfit = dispositions.reduce((sum, disposition) => sum + toNumber(disposition.sale_price) - toNumber(disposition.buy_price), 0)
  const assignmentFees = dispositions.reduce((sum, disposition) => sum + toNumber(disposition.assignment_fee), 0)
  const dealCosts = dispositions.reduce((sum, disposition) => sum + toNumber(disposition.closing_expenses) + toNumber(disposition.rehab_budget), 0)

  if (closedCount === 0) {
    return {
      grossProfit: 0,
      closedCount: 0,
      avgAssignmentFee: 0,
      marketingSpend: 0,
      netProfit: 0,
      marketingRoi: null,
      hasData: false,
    }
  }

  const closedPropertyIds = unique(dispositions.map((disposition) => disposition.property_id).filter((propertyId): propertyId is string => Boolean(propertyId)))
  let marketingSpend = 0

  if (closedPropertyIds.length > 0) {
    const campaigns = await readRows<{ id: string }>(
      client
        .from("campaigns")
        .select("id")
        .eq("org_id", orgId)
        .in("property_id", closedPropertyIds),
    )
    const campaignIds = unique(campaigns.map((campaign) => campaign.id))

    if (campaignIds.length > 0) {
      const recipients = await readRows<{ actual_cost_usd: number | string | null }>(
        client
          .from("campaign_recipients")
          .select("actual_cost_usd")
          .eq("org_id", orgId)
          .in("campaign_id", campaignIds),
      )
      marketingSpend = recipients.reduce((sum, recipient) => sum + toNumber(recipient.actual_cost_usd), 0)
    }
  }

  return {
    grossProfit,
    closedCount,
    avgAssignmentFee: assignmentFees / closedCount,
    marketingSpend,
    netProfit: grossProfit - dealCosts - marketingSpend,
    marketingRoi: marketingSpend > 0 ? grossProfit / marketingSpend : null,
    hasData: true,
  }
}

export async function fetchLiveDeals(orgId: string, client: SupabaseClient, limit = 8): Promise<LiveDeal[]> {
  const properties = await readRows<{
    id: string
    address: string | null
    city: string | null
    state: string | null
    status: string | null
    created_at: string
  }>(
    client
      .from("properties")
      .select("id, address, city, state, status, created_at")
      .eq("org_id", orgId)
      .in("status", ["available", "under_contract"])
      .order("created_at", { ascending: true })
      .limit(limit),
  )

  const propertyIds = properties.map((property) => property.id)
  const offerCounts = new Map<string, number>()

  if (propertyIds.length > 0) {
    const offers = await readRows<{ property_id: string | null }>(
      client
        .from("offers")
        .select("property_id")
        .eq("org_id", orgId)
        .in("property_id", propertyIds),
    )

    for (const offer of offers) {
      if (!offer.property_id) continue
      offerCounts.set(offer.property_id, (offerCounts.get(offer.property_id) ?? 0) + 1)
    }
  }

  const now = Date.now()

  return properties.map((property) => ({
    id: property.id,
    address: property.address,
    city: property.city,
    state: property.state,
    status: property.status,
    createdAt: property.created_at,
    daysOnMarket: Math.max(0, Math.floor((now - new Date(property.created_at).getTime()) / 86400000)),
    offerCount: offerCounts.get(property.id) ?? 0,
  }))
}

export async function fetchNeedsYouToday(orgId: string, client: SupabaseClient): Promise<NeedsYouToday> {
  const { startIso, endIso, todayDate } = getTodayBounds()

  const [unreadReplies, offersAwaiting, showingsToday, followUpsDue] = await Promise.all([
    readCount(client.from("message_threads").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("unread", true)),
    readCount(client.from("offers").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "submitted")),
    readCount(
      applyPeriod(
        client
          .from("showings")
          .select("*", { count: "exact", head: true })
          .eq("org_id", orgId)
          .neq("status", "canceled"),
        "scheduled_at",
        startIso,
        endIso,
      ),
    ),
    readCount(client.from("tasks").select("*", { count: "exact", head: true }).eq("org_id", orgId).is("completed_at", null).lte("due_date", todayDate)),
  ])

  return { unreadReplies, offersAwaiting, showingsToday, followUpsDue }
}

export async function fetchFunnel(range: TimeRange, orgId: string, client: SupabaseClient): Promise<DealFunnel> {
  const { periodStart, periodEnd } = getPeriod(range)
  const closingStart = periodStart.split("T")[0]
  const closingEnd = periodEnd.split("T")[0]

  const [buyers, showings, offers, closed] = await Promise.all([
    readCount(client.from("buyers").select("*", { count: "exact", head: true }).eq("org_id", orgId).is("deleted_at", null)),
    readCount(applyPeriod(client.from("showings").select("*", { count: "exact", head: true }).eq("org_id", orgId), "created_at", periodStart, periodEnd)),
    readCount(applyPeriod(client.from("offers").select("*", { count: "exact", head: true }).eq("org_id", orgId), "created_at", periodStart, periodEnd)),
    readCount(
      applyPeriod(
        client
          .from("dispositions")
          .select("*", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq("sale_status", "closed")
          .not("closing_date", "is", null),
        "closing_date",
        closingStart,
        closingEnd,
      ),
    ),
  ])

  return { buyers, showings, offers, closed }
}

export async function fetchTextTrends(range: TimeRange, orgId: string, client: SupabaseClient): Promise<TrendWithDelta<TextTrend>> {
  const { days, periodStart, periodEnd, prevStart, prevEnd } = getPeriod(range)
  const data = emptyBuckets<TextTrend>(days, ["sent", "received"])

  const [sentRows, receivedRows, prevSent] = await Promise.all([
    readRows<{ created_at: string }>(applyPeriod(client.from("messages").select("created_at").eq("org_id", orgId).eq("direction", "outbound").is("deleted_at", null), "created_at", periodStart, periodEnd)),
    readRows<{ created_at: string }>(applyPeriod(client.from("messages").select("created_at").eq("org_id", orgId).eq("direction", "inbound").is("deleted_at", null), "created_at", periodStart, periodEnd)),
    readCount(applyPeriod(client.from("messages").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("direction", "outbound").is("deleted_at", null), "created_at", prevStart, prevEnd)),
  ])

  bucketRows(data, sentRows, "created_at", "sent")
  bucketRows(data, receivedRows, "created_at", "received")

  return { data, delta: percentDelta(sentRows.length, prevSent) }
}

export async function fetchCallTrends(range: TimeRange, orgId: string, client: SupabaseClient): Promise<TrendWithDelta<CallTrend>> {
  const { days, periodStart, periodEnd, prevStart, prevEnd } = getPeriod(range)
  const data = emptyBuckets<CallTrend>(days, ["made", "received"])

  const [madeRows, receivedRows, prevMade] = await Promise.all([
    readRows<{ started_at: string }>(applyPeriod(client.from("calls").select("started_at").eq("org_id", orgId).eq("direction", "outbound"), "started_at", periodStart, periodEnd)),
    readRows<{ started_at: string }>(applyPeriod(client.from("calls").select("started_at").eq("org_id", orgId).eq("direction", "inbound"), "started_at", periodStart, periodEnd)),
    readCount(applyPeriod(client.from("calls").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("direction", "outbound"), "started_at", prevStart, prevEnd)),
  ])

  bucketRows(data, madeRows, "started_at", "made")
  bucketRows(data, receivedRows, "started_at", "received")

  return { data, delta: percentDelta(madeRows.length, prevMade) }
}

export async function fetchEmailTrends(range: TimeRange, orgId: string, client: SupabaseClient): Promise<TrendWithDelta<EmailTrend>> {
  const { days, periodStart, periodEnd, prevStart, prevEnd } = getPeriod(range)
  const data = emptyBuckets<EmailTrend>(days, ["sent"])

  const [sentRows, prevSent] = await Promise.all([
    readRows<{ sent_at: string }>(
      applyPeriod(
        client
          .from("campaign_recipients")
          .select("sent_at, campaigns!inner(channel)")
          .eq("org_id", orgId)
          .eq("campaigns.channel", "email")
          .not("sent_at", "is", null),
        "sent_at",
        periodStart,
        periodEnd,
      ),
    ),
    countEmailCampaignRecipients(client, orgId, "sent_at", prevStart, prevEnd),
  ])

  bucketRows(data, sentRows, "sent_at", "sent")

  return { data, delta: percentDelta(sentRows.length, prevSent) }
}

export async function fetchOfferTrends(range: TimeRange, orgId: string, client: SupabaseClient): Promise<TrendWithDelta<OfferTrend>> {
  const { days, periodStart, periodEnd, prevStart, prevEnd } = getPeriod(range)
  const data = emptyBuckets<OfferTrend>(days, ["created", "accepted"])

  const [createdRows, acceptedRows, prevCreated] = await Promise.all([
    readRows<{ created_at: string }>(applyPeriod(client.from("offers").select("created_at").eq("org_id", orgId), "created_at", periodStart, periodEnd)),
    readRows<{ accepted_at: string }>(applyPeriod(client.from("offers").select("accepted_at").eq("org_id", orgId).not("accepted_at", "is", null), "accepted_at", periodStart, periodEnd)),
    readCount(applyPeriod(client.from("offers").select("*", { count: "exact", head: true }).eq("org_id", orgId), "created_at", prevStart, prevEnd)),
  ])

  bucketRows(data, createdRows, "created_at", "created")
  bucketRows(data, acceptedRows, "accepted_at", "accepted")

  return { data, delta: percentDelta(createdRows.length, prevCreated) }
}

export async function fetchShowingTrends(range: TimeRange, orgId: string, client: SupabaseClient): Promise<TrendWithDelta<ShowingTrend>> {
  const { days, periodStart, periodEnd, prevStart, prevEnd } = getPeriod(range)
  const data = emptyBuckets<ShowingTrend>(days, ["created", "scheduled"])

  const [createdRows, scheduledRows, prevCreated] = await Promise.all([
    readRows<{ created_at: string }>(applyPeriod(client.from("showings").select("created_at").eq("org_id", orgId), "created_at", periodStart, periodEnd)),
    readRows<{ scheduled_at: string }>(applyPeriod(client.from("showings").select("scheduled_at").eq("org_id", orgId).not("scheduled_at", "is", null), "scheduled_at", periodStart, periodEnd)),
    readCount(applyPeriod(client.from("showings").select("*", { count: "exact", head: true }).eq("org_id", orgId), "created_at", prevStart, prevEnd)),
  ])

  bucketRows(data, createdRows, "created_at", "created")
  bucketRows(data, scheduledRows, "scheduled_at", "scheduled")

  return { data, delta: percentDelta(createdRows.length, prevCreated) }
}

export async function fetchUnsubscribeTrends(range: TimeRange, orgId: string, client: SupabaseClient): Promise<TrendWithDelta<UnsubscribeTrend>> {
  const { days, periodStart, periodEnd, prevStart, prevEnd } = getPeriod(range)
  const data = emptyBuckets<UnsubscribeTrend>(days, ["rate"])
  const countsByDate = new Map(data.map((item) => [item.date, { unsubscribes: 0, sends: 0 }]))

  const [smsUnsubRows, emailUnsubRows, textSentRows, emailSentRows, prevSmsUnsubs, prevEmailUnsubs, prevTextsSent, prevEmailsSent] = await Promise.all([
    readRows<{ sms_suppressed_at: string }>(applyPeriod(client.from("buyers").select("sms_suppressed_at").eq("org_id", orgId).not("sms_suppressed_at", "is", null), "sms_suppressed_at", periodStart, periodEnd)),
    readRows<{ unsubscribed_at: string }>(applyPeriod(client.from("buyers").select("unsubscribed_at").eq("org_id", orgId).eq("is_unsubscribed", true).not("unsubscribed_at", "is", null), "unsubscribed_at", periodStart, periodEnd)),
    readRows<{ created_at: string }>(applyPeriod(client.from("messages").select("created_at").eq("org_id", orgId).eq("direction", "outbound").is("deleted_at", null), "created_at", periodStart, periodEnd)),
    readRows<{ sent_at: string }>(
      applyPeriod(
        client
          .from("campaign_recipients")
          .select("sent_at, campaigns!inner(channel)")
          .eq("org_id", orgId)
          .eq("campaigns.channel", "email")
          .not("sent_at", "is", null),
        "sent_at",
        periodStart,
        periodEnd,
      ),
    ),
    readCount(applyPeriod(client.from("buyers").select("*", { count: "exact", head: true }).eq("org_id", orgId).not("sms_suppressed_at", "is", null), "sms_suppressed_at", prevStart, prevEnd)),
    readCount(applyPeriod(client.from("buyers").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("is_unsubscribed", true).not("unsubscribed_at", "is", null), "unsubscribed_at", prevStart, prevEnd)),
    readCount(applyPeriod(client.from("messages").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("direction", "outbound").is("deleted_at", null), "created_at", prevStart, prevEnd)),
    countEmailCampaignRecipients(client, orgId, "sent_at", prevStart, prevEnd),
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

export async function fetchRecentActivity(_range: TimeRange, orgId: string, client: SupabaseClient): Promise<RecentActivityItem[]> {
  const [buyers, offers, messages, showings] = await Promise.all([
    readRows<{ id: string; full_name: string | null; created_at: string }>(
      client.from("buyers").select("id, full_name, created_at").eq("org_id", orgId).is("deleted_at", null).order("created_at", { ascending: false }).limit(10),
    ),
    readRows<{ id: string; accepted_at: string | null; created_at: string }>(
      client.from("offers").select("id, accepted_at, created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(10),
    ),
    readRows<{ id: string; created_at: string }>(
      client.from("messages").select("id, created_at").eq("org_id", orgId).eq("direction", "inbound").is("deleted_at", null).order("created_at", { ascending: false }).limit(10),
    ),
    readRows<{ id: string; created_at: string }>(
      client.from("showings").select("id, created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(10),
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
