import { describe, beforeEach, test, expect, jest } from "@jest/globals"

let generateCopy: (p: string) => Promise<string>
let chat: (m: { role: string; content: string }[]) => Promise<string>
const fetchMock = jest.fn()
// @ts-ignore
global.fetch = fetchMock

describe("openai-service", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    process.env.OPENAI_API_KEY = "key"
    jest.resetModules()
    const svc = require("../services/openai-service")
    generateCopy = svc.generateCopy
    chat = svc.chat
  })

  test("sends prompt to API", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "Result" } }] }),
    })
    const text = await generateCopy("Hi")
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer key" }),
      }),
    )
    expect(text).toBe("Result")
  })

  test("throws on API error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "bad",
    })
    await expect(generateCopy("X")).rejects.toThrow("OpenAI API error 400: bad")
  })

  test("chat sends messages array", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "Ok" } }] }),
    })
    const msgs = [{ role: "user", content: "Hello" }]
    const text = await chat(msgs)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        body: JSON.stringify({
          model: "gpt-4o",
          messages: msgs,
          temperature: 0.7,
          max_tokens: 300,
        }),
      }),
    )
    expect(text).toBe("Ok")
  })
})
