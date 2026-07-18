import { describe, expect, test } from "vitest"
import { classifySmsFailure } from "@/lib/sms/failure-classifier"

describe("classifySmsFailure", () => {
  test("invalid recipient number → bad_recipient / invalid_number", () => {
    const c = classifySmsFailure("The 'to' address should be a single valid number.")
    expect(c.kind).toBe("bad_recipient")
    expect(c.reason).toBe("invalid_number")
  })

  test("landline (mobile-only) → bad_recipient / landline", () => {
    const c = classifySmsFailure("Mobile-only setting is active but the destination is not mobile")
    expect(c.kind).toBe("bad_recipient")
    expect(c.reason).toBe("landline")
  })

  test("bad sender number → bad_sender, senderNumber extracted as clean E.164", () => {
    const c = classifySmsFailure("Sending phone number '+14043482283' is not associated with the account")
    expect(c.kind).toBe("bad_sender")
    expect(c.reason).toBe("sender_not_on_account")
    expect(c.senderNumber).toBe("+14043482283")
  })

  test("transient errors → transient", () => {
    expect(classifySmsFailure("network error").kind).toBe("transient")
    expect(classifySmsFailure("Request timeout").kind).toBe("transient")
    expect(classifySmsFailure("rate limit exceeded").kind).toBe("transient")
  })

  test("unrelated / unknown message → other", () => {
    const c = classifySmsFailure("Something totally unexpected happened")
    expect(c.kind).toBe("other")
    expect(c.reason).toBe("other")
  })

  test("null / empty error text → other", () => {
    expect(classifySmsFailure(null).kind).toBe("other")
    expect(classifySmsFailure(undefined).kind).toBe("other")
    expect(classifySmsFailure("").kind).toBe("other")
  })
})
