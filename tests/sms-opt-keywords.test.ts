import {
  HELP_KEYWORDS,
  START_KEYWORDS,
  STOP_KEYWORDS,
  classifyInboundSms,
} from "../lib/sms/opt-keywords"

describe("classifyInboundSms", () => {
  test("classifies every STOP keyword", () => {
    for (const keyword of STOP_KEYWORDS) {
      expect(classifyInboundSms(keyword)).toBe("stop")
    }
  })

  test("classifies every HELP keyword", () => {
    for (const keyword of HELP_KEYWORDS) {
      expect(classifyInboundSms(keyword)).toBe("help")
    }
  })

  test("classifies every START keyword", () => {
    for (const keyword of START_KEYWORDS) {
      expect(classifyInboundSms(keyword)).toBe("start")
    }
  })

  test("supports multi-word OPT OUT", () => {
    expect(classifyInboundSms("OPT OUT")).toBe("stop")
  })

  test("matches single-word keywords by first token", () => {
    expect(classifyInboundSms("Stop please")).toBe("stop")
  })

  test("normalizes lowercase and trailing punctuation", () => {
    expect(classifyInboundSms("cancel!")).toBe("stop")
  })

  test("returns null for non-keyword text", () => {
    expect(classifyInboundSms("Thanks, I will call you later.")).toBeNull()
  })
})
