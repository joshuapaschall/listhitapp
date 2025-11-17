import { describe, beforeEach, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"
import { GET } from "../app/api/calls/history/route"

let selectColumns: string | null = null
let orderColumn: string | null = null
let rangeArgs: [number, number] | null = null
const sampleCalls = [
  {
    id: "call-1",
    call_sid: "CSID123",
    from_agent_id: "agent-42",
    recording_confidence: 0.82,
    telnyx_recording_id: "rec-1",
    status: "completed",
    duration: 120,
    started_at: new Date().toISOString(),
    direction: "outbound",
    buyer_id: null,
  }
]

const fetchMock = jest.fn().mockResolvedValue({ ok: true })
// @ts-ignore
global.fetch = fetchMock

jest.mock("../lib/supabase", () => {
  const result = { data: sampleCalls, error: null, count: sampleCalls.length }
  const builder: any = {
    select: (columns: string, _options?: any) => {
      selectColumns = columns
      return builder
    },
    or: () => builder,
    eq: () => builder,
    gte: () => builder,
    lt: () => builder,
    is: () => builder,
    order: (column: string, options: { ascending: boolean }) => {
      orderColumn = `${column}:${options.ascending ? "asc" : "desc"}`
      return builder
    },
    range: (from: number, to: number) => {
      rangeArgs = [from, to]
      return builder
    },
    then: (resolve: any, reject?: any) => {
      if (resolve) {
        return Promise.resolve(resolve(result))
      }
      if (reject) {
        return Promise.resolve(reject(result))
      }
      return Promise.resolve(result)
    }
  }

  return {
    supabase: null,
    supabaseAdmin: {
      from: (table: string) => {
        if (table !== "calls") {
          throw new Error(`Unexpected table ${table}`)
        }
        return builder
      }
    }
  }
})

describe("/api/calls/history", () => {
  beforeEach(() => {
    selectColumns = null
    orderColumn = null
    rangeArgs = null
    fetchMock.mockClear()
  })

  test("selects agent and recording confidence fields", async () => {
    const request = new NextRequest("http://test/api/calls/history?page=1&pageSize=25")

    const response = await GET(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(selectColumns).toContain("recording_confidence")
    expect(selectColumns).toContain("from_agent:agents!calls_from_agent_id_fkey")
    expect(orderColumn).toBe("started_at:desc")
    expect(rangeArgs).toEqual([0, 24])
    expect(payload.calls[0].from_agent_id).toBe("agent-42")
    expect(payload.calls[0].recording_confidence).toBe(0.82)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
