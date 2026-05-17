import { beforeEach, describe, expect, jest, test } from "@jest/globals"

let createCampaign: any
let sendCampaign: any
let getCampaignStats: any
let unsubscribe: any
let getMe: any

const fetchMock = jest.fn()
// @ts-ignore
global.fetch = fetchMock

jest.mock("../lib/supabase", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        in: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  },
}))

describe("sendfox-service campaigns", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    process.env.SENDFOX_API_TOKEN = "tok"
    jest.resetModules()
    const mod = require("../services/sendfox-service")
    createCampaign = mod.createCampaign
    sendCampaign = mod.sendCampaign
    getCampaignStats = mod.getCampaignStats
    unsubscribe = mod.unsubscribe
    getMe = mod.getMe
  })

  test("createCampaign sends correct payload to POST /campaigns", async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => "{}" })
    const payload = { name: "May Blast", subject: "Hi", body_html: "<p>hello</p>" }
    await createCampaign(payload)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://sendfox.com/api/campaigns",
      expect.objectContaining({ method: "POST", body: JSON.stringify(payload) }),
    )
  })

  test("sendCampaign hits POST /campaigns/{id}/send", async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => "{}" })
    await sendCampaign(42)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://sendfox.com/api/campaigns/42/send",
      expect.objectContaining({ method: "POST" }),
    )
  })

  test("getCampaignStats hits GET /campaigns/{id}/stats", async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => "{}" })
    await getCampaignStats(99)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://sendfox.com/api/campaigns/99/stats",
      expect.objectContaining({ method: undefined }),
    )
  })

  test("unsubscribe now uses PATCH /unsubscribe", async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => "{}" })
    await unsubscribe("c@test.com")
    expect(fetchMock).toHaveBeenCalledWith(
      "https://sendfox.com/api/unsubscribe",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ email: "c@test.com" }) }),
    )
  })

  test("getMe hits GET /me", async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => "{}" })
    await getMe()
    expect(fetchMock).toHaveBeenCalledWith(
      "https://sendfox.com/api/me",
      expect.objectContaining({ method: undefined }),
    )
  })
})
