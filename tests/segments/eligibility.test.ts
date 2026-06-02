import { applyChannelEligibility } from "@/lib/segments/eligibility"

interface Call {
  m: string
  args: any[]
}

// Chainable query stub recording every filter call.
function makeQuery() {
  const calls: Call[] = []
  const q: any = {}
  for (const m of ["eq", "is", "not"]) {
    q[m] = (...args: any[]) => {
      calls.push({ m, args })
      return q
    }
  }
  q.calls = calls
  return q
}

describe("applyChannelEligibility", () => {
  test("email branch applies email suppression/consent/contactability", () => {
    const q = makeQuery()
    applyChannelEligibility(q, "email")
    expect(q.calls).toEqual([
      { m: "is", args: ["deleted_at", null] },
      { m: "eq", args: ["email_suppressed", false] },
      { m: "eq", args: ["can_receive_email", true] },
      { m: "not", args: ["email", "is", null] },
    ])
  })

  test("sms branch gates on can_receive_sms + sms_suppressed + phone, NOT email_suppressed", () => {
    const q = makeQuery()
    applyChannelEligibility(q, "sms")
    expect(q.calls).toEqual([
      { m: "is", args: ["deleted_at", null] },
      { m: "eq", args: ["can_receive_sms", true] },
      { m: "eq", args: ["sms_suppressed", false] },
      { m: "not", args: ["phone", "is", null] },
    ])
    // Never gated on email_suppressed for SMS.
    expect(q.calls.some((c) => c.args[0] === "email_suppressed")).toBe(false)
  })

  test("honors a join prefix on every column", () => {
    const q = makeQuery()
    applyChannelEligibility(q, "sms", "buyers.")
    expect(q.calls).toEqual([
      { m: "is", args: ["buyers.deleted_at", null] },
      { m: "eq", args: ["buyers.can_receive_sms", true] },
      { m: "eq", args: ["buyers.sms_suppressed", false] },
      { m: "not", args: ["buyers.phone", "is", null] },
    ])
  })
})
