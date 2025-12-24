import { describe, beforeEach, afterEach, test, expect, jest } from "@jest/globals"

interface Campaign {
  id: string
  scheduled_at: string
  status: string
  weekday_only?: boolean | null
  run_from?: string | null
  run_until?: string | null
  timezone?: string | null
}

let campaigns: Campaign[] = []
let updateCalls: any[] = []
const fetchMock = jest.fn()

const supabase = {
  from: (table: string) => {
    if (table !== "campaigns") throw new Error(`Unexpected table ${table}`)
    return {
      select: () => ({
        lte: (_col: string, val: string) => ({
          eq: async (_c: string, status: string) => ({
            data: campaigns.filter(
              (c) => new Date(c.scheduled_at) <= new Date(val) && c.status === status,
            ),
            error: null,
          }),
        }),
      }),
      update: (updates: any) => ({
        eq: async (_col: string, id: string) => {
          updateCalls.push({ updates, id })
          const row = campaigns.find((c) => c.id === id)
          Object.assign(row || {}, updates)
          return { data: row, error: null }
        },
      }),
    }
  },
}

async function runEdge() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const base = process.env.DISPOTOOL_BASE_URL ?? process.env.SITE_URL ?? ""

  if (!base) {
    console.error("Missing base URL")
    return
  }

  const { data } = await supabase
    .from("campaigns")
    .select("id, weekday_only, run_from, run_until, timezone")
    .lte("scheduled_at", new Date().toISOString())
    .eq("status", "pending")

  const resolveTimezone = (tz?: string | null) =>
    tz && tz.trim() ? tz : "America/New_York"
  const getNowInTimezone = (tz: string) =>
    new Date(new Date().toLocaleString("en-US", { timeZone: tz }))

  for (const c of data ?? []) {
    const timezone = resolveTimezone(c.timezone)
    const zonedNow = getNowInTimezone(timezone)
    if (c.weekday_only && (zonedNow.getDay() === 0 || zonedNow.getDay() === 6)) {
      continue
    }
    if (c.run_from && c.run_until) {
      const [fh, fm] = c.run_from.split(":").map(Number)
      const [th, tm] = c.run_until.split(":").map(Number)
      const nowMin = zonedNow.getHours() * 60 + zonedNow.getMinutes()
      const fromMin = fh * 60 + fm
      const toMin = th * 60 + tm
      if (nowMin < fromMin || nowMin > toMin) {
        continue
      }
    }

    await supabase.from("campaigns").update({ status: "processing" }).eq("id", c.id)

    const resp = await fetchMock(`${base}/api/campaigns/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ campaignId: c.id }),
    })

    const isRedirect = resp.status >= 300 && resp.status < 400

    if (isRedirect || !resp.ok) {
      await supabase.from("campaigns").update({ status: "pending" }).eq("id", c.id)
    }
  }
}

describe("send-scheduled-campaigns", () => {
  beforeEach(() => {
    campaigns = []
    updateCalls = []
    fetchMock.mockReset()
    jest.useFakeTimers()
    process.env.SUPABASE_SERVICE_ROLE_KEY = "key"
    process.env.DISPOTOOL_BASE_URL = "http://localhost"
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test("marks processing then pending on failure", async () => {
    jest.setSystemTime(new Date("2024-06-21T16:00:00Z"))
    campaigns.push({ id: "c1", scheduled_at: "2024-06-21T15:00:00Z", status: "pending" })
    fetchMock.mockResolvedValue({ ok: false, text: async () => "bad" })

    await runEdge()

    expect(fetchMock).toHaveBeenCalledWith(
      `${process.env.DISPOTOOL_BASE_URL}/api/campaigns/send`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer key" }),
      }),
    )
    expect(updateCalls[0]).toEqual({ updates: { status: "processing" }, id: "c1" })
    expect(updateCalls[1]).toEqual({ updates: { status: "pending" }, id: "c1" })
    expect(campaigns[0].status).toBe("pending")
  })

  test("skips on weekend when weekday_only", async () => {
    jest.setSystemTime(new Date("2024-06-22T16:00:00Z"))
    campaigns.push({ id: "c1", scheduled_at: "2024-06-22T15:00:00Z", status: "pending", weekday_only: true })
    fetchMock.mockResolvedValue({ ok: true })

    await runEdge()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(updateCalls.length).toBe(0)
    expect(campaigns[0].status).toBe("pending")
  })

  test("skips outside time window", async () => {
    jest.setSystemTime(new Date("2024-06-21T06:00:00Z"))
    campaigns.push({
      id: "c1",
      scheduled_at: "2024-06-21T05:00:00Z",
      status: "pending",
      run_from: "09:00:00",
      run_until: "17:00:00",
      timezone: "America/New_York",
    })
    fetchMock.mockResolvedValue({ ok: true })

    await runEdge()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(updateCalls.length).toBe(0)
    expect(campaigns[0].status).toBe("pending")
  })

  test("exits early when base url missing", async () => {
    jest.setSystemTime(new Date("2024-06-21T16:00:00Z"))
    campaigns.push({ id: "c1", scheduled_at: "2024-06-21T15:00:00Z", status: "pending" })
    delete process.env.DISPOTOOL_BASE_URL
    delete process.env.SITE_URL
    fetchMock.mockResolvedValue({ ok: true })

    await runEdge()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(updateCalls.length).toBe(0)
    expect(campaigns[0].status).toBe("pending")
  })

  test("treats redirects as failures", async () => {
    jest.setSystemTime(new Date("2024-06-21T16:00:00Z"))
    campaigns.push({ id: "c1", scheduled_at: "2024-06-21T15:00:00Z", status: "pending", timezone: "America/New_York" })
    fetchMock.mockResolvedValue({
      ok: false,
      status: 302,
      headers: { get: () => "http://example.com" },
      text: async () => "redirect",
    })

    await runEdge()

    expect(updateCalls[0]).toEqual({ updates: { status: "processing" }, id: "c1" })
    expect(updateCalls[1]).toEqual({ updates: { status: "pending" }, id: "c1" })
    expect(campaigns[0].status).toBe("pending")
  })

  test("uses campaign timezone for send window checks", async () => {
    jest.setSystemTime(new Date("2024-06-21T06:45:00Z"))
    campaigns.push({
      id: "c1",
      scheduled_at: "2024-06-21T06:00:00Z",
      status: "pending",
      run_from: "06:00:00",
      run_until: "08:00:00",
      timezone: "Europe/London",
    })
    fetchMock.mockResolvedValue({ ok: true, status: 200 })

    await runEdge()

    expect(fetchMock).toHaveBeenCalled()
    expect(campaigns[0].status).toBe("processing")
  })
})
