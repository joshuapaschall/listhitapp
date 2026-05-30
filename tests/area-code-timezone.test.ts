import {
  DEFAULT_TIMEZONE,
  isWithinQuietHours,
  nextSendTime,
  timezoneForNumber,
} from "../lib/sms/area-code-timezone"

describe("area-code timezone SMS quiet hours", () => {
  test("resolves known NANP area codes to recipient timezones", () => {
    expect(timezoneForNumber("+17705550100")).toBe("America/New_York")
    expect(timezoneForNumber("+13125550100")).toBe("America/Chicago")
    expect(timezoneForNumber("+13035550100")).toBe("America/Denver")
    expect(timezoneForNumber("+12135550100")).toBe("America/Los_Angeles")
    expect(timezoneForNumber("+18085550100")).toBe("Pacific/Honolulu")
  })

  test("falls back to the default timezone for unknown or unparseable area codes", () => {
    expect(timezoneForNumber("+19995550100")).toBe(DEFAULT_TIMEZONE)
    expect(timezoneForNumber("not-a-phone-number")).toBe(DEFAULT_TIMEZONE)
  })

  test("allows sends inside 8am-9pm local recipient time", () => {
    expect(isWithinQuietHours("+17705550100", new Date("2026-01-15T19:00:00.000Z"))).toBe(true)
  })

  test("blocks sends after 9pm local recipient time", () => {
    expect(isWithinQuietHours("+17705550100", new Date("2026-01-16T04:00:00.000Z"))).toBe(false)
  })

  test("blocks sends before 8am local recipient time", () => {
    expect(isWithinQuietHours("+17705550100", new Date("2026-01-15T11:00:00.000Z"))).toBe(false)
  })

  test("keeps next send time unchanged when already inside the local window", () => {
    const inWindow = new Date("2026-01-15T19:00:00.000Z")
    expect(nextSendTime("+17705550100", inWindow)).toBe(inWindow)
  })

  test("moves next send time later when outside the local window", () => {
    const outOfWindow = new Date("2026-01-16T04:00:00.000Z")
    expect(nextSendTime("+17705550100", outOfWindow).getTime()).toBeGreaterThan(outOfWindow.getTime())
  })
})
