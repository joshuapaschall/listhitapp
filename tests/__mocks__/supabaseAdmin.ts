import { jest } from "@jest/globals"

type AgentRecord = {
  id: string
  auth_user_id: string
  sip_username: string | null
  sip_password: string | null
  telnyx_credential_id: string | null
}

let agentRecord: AgentRecord = {
  id: "agent-1",
  auth_user_id: "user-1",
  sip_username: "sip_1001",
  sip_password: "pass-123",
  telnyx_credential_id: "cred-1",
}

export const supabaseAdminAuthGetUserMock = jest.fn(async () => ({
  data: { user: null },
  error: null,
}))

export function __setAgentRecord(record: AgentRecord) {
  agentRecord = record
}

export const supabaseAdmin = {
  from: () => ({
    select: (columns: string) => {
      return {
        eq: () => ({
          maybeSingle: async () => ({ data: agentRecord, error: null }),
        }),
      }
    },
  }),
  auth: {
    getUser: (...args: any[]) => supabaseAdminAuthGetUserMock(...args),
  },
}
