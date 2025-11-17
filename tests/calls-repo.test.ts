import { beforeEach, describe, expect, test, jest } from "@jest/globals"

type SessionRecord = {
  agent_session_id: string
  customer_call_control_id: string
  status: "dialing" | "ringing" | "bridged" | "ended"
}

type CallsState = {
  sessions: Map<string, SessionRecord>
  upserts: Array<{ payload: SessionRecord; options: any }>
}

const callsState: CallsState = {
  sessions: new Map(),
  upserts: [],
}

jest.mock("../lib/supabase", () => {
  const getRecord = (filters: Record<string, string>) => {
    for (const record of callsState.sessions.values()) {
      const matches = Object.entries(filters).every(([column, value]) => record[column as keyof SessionRecord] === value)
      if (matches) return record
    }
    return null
  }

  return {
    supabase: null,
    supabaseAdmin: {
      from: (table: string) => {
        if (table !== "calls_sessions") {
          throw new Error(`Unexpected table ${table}`)
        }

        return {
          upsert: async (payload: SessionRecord, options: any) => {
            callsState.upserts.push({ payload, options })
            const updated: SessionRecord = { ...payload }
            callsState.sessions.set(updated.agent_session_id, updated)
            return { data: updated, error: null }
          },
          update: (values: Partial<SessionRecord>) => {
            const filters: Record<string, string> = {}
            const execute = () => {
              const record = getRecord(filters)
              if (record) {
                Object.assign(record, values)
                callsState.sessions.set(record.agent_session_id, record as SessionRecord)
              }
              return { data: record ? [record] : [], error: null }
            }
            const query: any = {
              eq: (column: string, value: string) => {
                filters[column] = value
                return query
              },
              then: (resolve: any, reject?: any) => {
                try {
                  const result = execute()
                  return Promise.resolve(resolve ? resolve(result) : result)
                } catch (error) {
                  if (reject) {
                    return Promise.resolve(reject(error))
                  }
                  throw error
                }
              },
            }
            return query
          },
        }
      },
    },
    __callsState: callsState,
  }
})

const { saveCustomerLeg, markBridged } = require("../lib/calls-repo")
const { __callsState } = require("../lib/supabase") as { __callsState: CallsState }

describe("calls-repo", () => {
  beforeEach(() => {
    __callsState.sessions.clear()
    __callsState.upserts.length = 0
  })

  test("saveCustomerLeg upserts by agent_session_id and refreshes leg details", async () => {
    await saveCustomerLeg({
      agentSessionId: "agent-123",
      customerCallControlId: "call-1",
      status: "dialing",
    })

    expect(__callsState.upserts).toHaveLength(1)
    expect(__callsState.upserts[0].options).toEqual({ onConflict: "agent_session_id" })

    let record = __callsState.sessions.get("agent-123")
    expect(record).toBeDefined()
    expect(record?.customer_call_control_id).toBe("call-1")
    expect(record?.status).toBe("dialing")

    await saveCustomerLeg({
      agentSessionId: "agent-123",
      customerCallControlId: "call-2",
      status: "ringing",
    })

    expect(__callsState.upserts).toHaveLength(2)
    record = __callsState.sessions.get("agent-123")
    expect(record?.customer_call_control_id).toBe("call-2")
    expect(record?.status).toBe("ringing")
    expect(__callsState.sessions.size).toBe(1)
  })

  test("markBridged updates the status for the active customer leg", async () => {
    await saveCustomerLeg({
      agentSessionId: "agent-123",
      customerCallControlId: "call-2",
      status: "ringing",
    })

    await markBridged({ agentSessionId: "agent-123", customerCallControlId: "call-2" })

    const record = __callsState.sessions.get("agent-123")
    expect(record?.status).toBe("bridged")
    expect(record?.customer_call_control_id).toBe("call-2")
  })
})
