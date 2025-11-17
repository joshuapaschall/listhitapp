import { beforeEach, describe, expect, jest, test } from "@jest/globals"
import { NextRequest } from "next/server"

import { POST } from "../app/api/calls/outbound/route"

const fetchMock = jest.fn()
// @ts-ignore
global.fetch = fetchMock

const requireAgentMock = jest.fn()

jest.mock("@/lib/agent-auth", () => ({
  requireAgent: (...args: any[]) => requireAgentMock(...args),
}))

jest.mock("@/lib/calls-repo", () => ({
  saveCustomerLeg: jest.fn(),
}))

describe("/api/calls/outbound", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    requireAgentMock.mockReset()
    jest.clearAllMocks()
    process.env.TELNYX_API_KEY = "api_key"
    process.env.CALL_CONTROL_APP_ID = "cc-app-1"
    process.env.FROM_NUMBER = "+15551234567"
    delete process.env.VOICE_CONNECTION_ID
    delete process.env.TELNYX_VOICE_CONNECTION_ID
    requireAgentMock.mockResolvedValue({
      id: "agent-1",
      sip_username: "sip_agent_1",
    })
  })

  test("creates outbound call to the agent first", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 202,
      text: async () => JSON.stringify({ data: { call_control_id: "CA1" } }),
    })

    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ to: "+16785550123" }),
    })

    const res = await POST(req)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.telnyx.com/v2/calls")
    const payload = JSON.parse(init.body)
    expect(payload.connection_id).toBe("cc-app-1")
    expect(payload.from).toBe("+15551234567")
    expect(payload.to).toBe("sip:sip_agent_1@sip.telnyx.com")

    const decoded = JSON.parse(Buffer.from(payload.client_state, "base64").toString("utf8"))
    expect(decoded).toEqual({ kind: "agent_to_pstn", dest: "+16785550123" })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      ok: true,
      data: { call_control_id: "CA1" },
    })
  })

  test("returns validation error when destination missing", async () => {
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({}),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: "Missing or invalid destination",
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("returns validation error when agent has no sip username", async () => {
    requireAgentMock.mockResolvedValueOnce({ id: "agent-1", sip_username: null })

    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ to: "+16785550123" }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: "Agent missing SIP username",
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("propagates Telnyx error responses", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => JSON.stringify({ errors: [{ detail: "Invalid value for connection_id" }] }),
    })

    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ to: "+14155550123" }),
    })

    const res = await POST(req)
    expect(res.status).toBe(422)
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: "Invalid value for connection_id",
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test("returns server error when TELNYX_API_KEY missing", async () => {
    delete process.env.TELNYX_API_KEY

    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ to: "+14155550123" }),
    })

    const res = await POST(req)
    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: "Missing TELNYX_API_KEY",
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("returns server error when Call Control App ID missing", async () => {
    delete process.env.VOICE_CONNECTION_ID
    delete process.env.CALL_CONTROL_APP_ID

    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ to: "+14155550123" }),
    })

    const res = await POST(req)
    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: "Missing CALL_CONTROL_APP_ID",
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("falls back to default FROM_NUMBER when custom number invalid", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 202,
      text: async () => JSON.stringify({ data: { call_control_id: "CA1" } }),
    })

    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ to: "+16785550123", from: "1234" }),
    })

    await POST(req)

    const [, init] = fetchMock.mock.calls[0]
    const payload = JSON.parse(init.body)
    expect(payload.from).toBe("+15551234567")
  })
})
