import { describe, expect, test, beforeEach, jest } from "@jest/globals"

let upsertContact: any
let getOrCreateList: any
let sendEmail: any
let unsubscribe: any
let sendEmailCampaign: any
let SendFoxError: any
let addContactToList: any
let fetchLists: any

const fetchMock = jest.fn()
// @ts-ignore
global.fetch = fetchMock

let groups: any[] = []
jest.mock("../lib/supabase", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        in: (_col: string, values: any[]) =>
          Promise.resolve({
            data: groups.filter((g) => values.includes(g.sendfox_list_id)),
            error: null,
          }),
      }),
    }),
  },
}))

describe("sendfox-service", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    groups = []
    process.env.SENDFOX_API_TOKEN = "tok"
    jest.resetModules()
    const mod = require("../services/sendfox-service")
    upsertContact = mod.upsertContact
    addContactToList = mod.addContactToList
    getOrCreateList = mod.getOrCreateList
    sendEmail = mod.sendEmail
    unsubscribe = mod.unsubscribe
    fetchLists = mod.fetchLists
    SendFoxError = mod.SendFoxError
    sendEmailCampaign = require("../services/campaign-sender").sendEmailCampaign
  })

  test("upsertContact posts contact data", async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => "{}" })
    await upsertContact("a@test.com", "A", "T", [1], ["vip"], "1.1.1.1")
    expect(fetchMock).toHaveBeenCalledWith(
      "https://sendfox.com/api/contacts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "a@test.com",
          first_name: "A",
          last_name: "T",
          lists: [1],
          tags: ["vip"],
          ip_address: "1.1.1.1",
        }),
        headers: expect.objectContaining({
          Authorization: "Bearer tok",
          "Content-Type": "application/json",
        }),
      }),
    )
  })

  test("addContactToList posts contact to list", async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => "{}" })
    await addContactToList(5, {
      email: "a@test.com",
      first_name: "A",
      last_name: "B",
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "https://sendfox.com/api/contacts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "a@test.com",
          first_name: "A",
          last_name: "B",
          lists: [5],
        }),
      }),
    )
  })

  test("getOrCreateList posts when list missing", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, text: async () => "[]" })
      .mockResolvedValueOnce({ ok: true, text: async () => "{\"id\":2}" })
    const result = await getOrCreateList("NewList")
    expect(result).toEqual({ id: 2 })
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://sendfox.com/api/lists", expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://sendfox.com/api/lists",
      expect.objectContaining({ method: "POST" }),
    )
  })

  test("fetchLists maps SendFox lists to groups", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () =>
        '[{"id":1,"name":"List A","contact_count":5,"created_at":"2024-01-01"}]',
    })
    groups.push({ id: "g1", name: "Group1", sendfox_list_id: 1 })
    const lists = await fetchLists()
    expect(lists).toEqual([
      {
        id: 1,
        name: "List A",
        contact_count: 5,
        created_at: "2024-01-01",
        group: { id: "g1", name: "Group1" },
      },
    ])
  })

  test("sendEmail posts email payload", async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => "{}" })
    await sendEmail("b@test.com", "Sub", "<p>x</p>")
    expect(fetchMock).toHaveBeenCalledWith(
      "https://sendfox.com/api/emails",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          contacts: ["b@test.com"],
          subject: "Sub",
          html: "<p>x</p>",
          do_not_send: false,
        }),
        headers: expect.objectContaining({ Authorization: "Bearer tok" }),
      }),
    )
  })

  test("unsubscribe posts email", async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => "{}" })
    await unsubscribe("c@test.com")
    expect(fetchMock).toHaveBeenCalledWith(
      "https://sendfox.com/api/contacts/unsubscribe",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "c@test.com" }),
      }),
    )
  })

  test("sendEmailCampaign sends email via API", async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => "{\"id\":\"e1\"}" })
    const id = await sendEmailCampaign({
      to: "d@test.com",
      subject: "Hello",
      html: "<p>hi</p>",
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "https://sendfox.com/api/emails",
      expect.objectContaining({ method: "POST" }),
    )
    expect(id).toBe("e1")
  })

  test("maps status codes to SendFoxError", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => "nope" })
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => "nope" })
    await upsertContact("e@test.com").catch((err: any) => {
      expect(err).toBeInstanceOf(SendFoxError)
      expect(err).toMatchObject({ type: "unauthorized", status: 401 })
    })
  })

  test("retries once on failure", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce({ ok: true, text: async () => "{}" })
    await upsertContact("f@test.com")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test("upsertContact returns existing contact when already exists", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Contact already exists",
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Contact already exists",
      })
      .mockResolvedValueOnce({ ok: true, text: async () => "[{\"id\":7}]" })
    const res = await upsertContact("g@test.com")
    expect(res).toEqual({ id: 7 })
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://sendfox.com/api/contacts?email=g%40test.com",
      expect.any(Object),
    )
  })

  test("addContactToList ignores already exists error", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Already exists",
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Already exists",
      })
      .mockResolvedValueOnce({ ok: true, text: async () => "[{\"id\":9}]" })
    const res = await addContactToList(3, { email: "h@test.com" })
    expect(res).toEqual({ id: 9 })
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://sendfox.com/api/contacts?email=h%40test.com",
      expect.any(Object),
    )
  })
})
