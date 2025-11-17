import { describe, test, expect } from "@jest/globals"
import { formatSmartTimestamp } from "../utils/date"

jest.useFakeTimers().setSystemTime(new Date("2024-01-08T12:00:00Z"))

describe("formatSmartTimestamp", () => {
  test("formats today", () => {
    const ts = new Date("2024-01-08T08:30:00Z")
    expect(formatSmartTimestamp(ts)).toMatch(/\d{1,2}:\d{2} [AP]M/)
  })

  test("formats yesterday", () => {
    const ts = new Date("2024-01-07T11:00:00Z")
    expect(formatSmartTimestamp(ts)).toBe("Yesterday")
  })

  test("formats within 7 days", () => {
    const ts = new Date("2024-01-03T11:00:00Z")
    expect(formatSmartTimestamp(ts)).toBe("Jan 3")
  })

  test("formats older", () => {
    const ts = new Date("2023-12-20T12:00:00Z")
    expect(formatSmartTimestamp(ts)).toBe("Dec 20")
  })
})
