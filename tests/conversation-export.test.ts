import { describe, expect, test } from "@jest/globals"
import { formatConversationAsCSV, formatConversationAsJSON } from "../lib/conversation-export"

const msgs = [
  {
    id: "m1",
    thread_id: "t1",
    buyer_id: "b1",
    direction: "outbound",
    from_number: "+1222",
    to_number: "+1333",
    body: "Hello",
    provider_id: null,
    is_bulk: false,
    filtered: false,
    created_at: "2025-01-01T00:00:00Z",
    deleted_at: null,
  },
]

describe("conversation export utils", () => {
  test("formats json", () => {
    const json = formatConversationAsJSON(msgs as any)
    const obj = JSON.parse(json)
    expect(obj.length).toBe(1)
    expect(obj[0].body).toBe("Hello")
  })

  test("formats csv", () => {
    const csv = formatConversationAsCSV(msgs as any)
    expect(csv).toContain("Hello")
    expect(csv.split("\n").length).toBeGreaterThan(1)
  })
})
