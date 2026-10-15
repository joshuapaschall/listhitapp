import {
  CARRIER_DECLINED_MESSAGE,
  LEGAL_NAME_MISMATCH_MESSAGE,
  RESUBMISSIONS_EXHAUSTED_MESSAGE,
  issuesFromBrandErrors,
  issuesFromCampaignErrors,
  issuesFromEvaluation,
  issuesHash,
} from "@/lib/org-twilio/issues"

const JARGON = /\b(TCR|TrustProduct|EndUser)\b/

describe("issuesFromCampaignErrors / issuesFromBrandErrors", () => {
  test("30893 → samples, fixable", () => {
    const [issue] = issuesFromCampaignErrors([{ error_code: 30893, description: "Sample messages lack brand name" }])
    expect(issue).toMatchObject({ field: "samples", fixable: true, code: "30893" })
  })

  test.each(["30882", "30883", "30884", "30885"])("%s → not fixable, carriers declined", (code) => {
    const [issue] = issuesFromBrandErrors([{ error_code: code, description: "whatever" }])
    expect(issue).toMatchObject({ field: "other", fixable: false, message: CARRIER_DECLINED_MESSAGE, code })
  })

  test("a tax-id / name mismatch → legal_name with the CP 575 message", () => {
    const [issue] = issuesFromBrandErrors([
      { error_code: 30794, description: "Tax ID does not match the legal company name on file" },
    ])
    expect(issue).toMatchObject({ field: "legal_name", fixable: true, message: LEGAL_NAME_MISMATCH_MESSAGE })
    expect(issue.message).toContain("CP 575")
  })

  test("too many brands for this EIN → ein, not fixable", () => {
    const [issue] = issuesFromBrandErrors([{ error_code: 30799, description: "Too many brands registered with this EIN" }])
    expect(issue).toMatchObject({ field: "ein", fixable: false })
  })

  test("website problems → website, fixable", () => {
    const [issue] = issuesFromCampaignErrors([{ error_code: 30800, description: "Website is not accessible" }])
    expect(issue).toMatchObject({ field: "website", fixable: true })
  })

  test("unknown → other, fixable, keeping Twilio's description", () => {
    const [issue] = issuesFromBrandErrors([{ error_code: 99999, description: "Something unusual happened" }])
    expect(issue).toMatchObject({ field: "other", fixable: true })
    expect(issue.message).toContain("Something unusual happened")
  })

  test("messages never carry Twilio jargon", () => {
    const issues = issuesFromBrandErrors([{ error_code: 1, description: "TCR rejected the TrustProduct EndUser" }])
    for (const i of issues) expect(i.message).not.toMatch(JARGON)
  })

  test("an empty error list still gives the customer something actionable", () => {
    expect(issuesFromBrandErrors([])).toHaveLength(1)
    expect(issuesFromCampaignErrors(null)).toHaveLength(1)
  })
})

describe("issuesFromEvaluation", () => {
  const results = [
    {
      friendly_name: "Authorized Representative",
      passed: false,
      fields: [
        { object_field: "email", passed: false, failure_reason: "Email of Authorized Representative #1 is invalid." },
        { object_field: "first_name", passed: true, failure_reason: null },
      ],
    },
  ]

  test("maps an email failure to rep and keeps Twilio's failure_reason", () => {
    const issues = issuesFromEvaluation(results)
    const rep = issues.find((i) => i.message.includes("Email of Authorized Representative #1 is invalid."))
    expect(rep).toBeDefined()
    expect(rep!.field).toBe("rep")
    expect(rep!.fixable).toBe(true)
  })

  test("maps an address failure to address", () => {
    const issues = issuesFromEvaluation([{ passed: false, failure_reason: "Address street is missing." }])
    expect(issues[0].field).toBe("address")
  })

  test("no recognizable failures → one generic, fixable issue", () => {
    const issues = issuesFromEvaluation([])
    expect(issues).toHaveLength(1)
    expect(issues[0].fixable).toBe(true)
  })

  const sequencing = {
    friendly_name: "Secondary Customer Profile",
    passed: false,
    fields: [
      { object_field: "status", passed: false, failure_reason: "Secondary Customer Profile registration Proof" },
      { object_field: "status", passed: false, failure_reason: "The status of the Secondary Customer Profile must be in atleast review state" },
      { object_field: "status", passed: false, failure_reason: "Secondary registration registration Proof" },
      { object_field: "status", passed: false, failure_reason: "The status of the Secondary registration must be in atleast review state" },
    ],
  }

  test("only Twilio sequencing failures → no customer issues (internal retry)", () => {
    expect(issuesFromEvaluation([sequencing])).toEqual([])
  })

  test("sequencing failures are dropped but real ones are kept", () => {
    const issues = issuesFromEvaluation([sequencing, { passed: false, failure_reason: "Address street is missing." }])
    expect(issues).toHaveLength(1)
    expect(issues[0].field).toBe("address")
  })
})

describe("customer-facing messages never contain Twilio jargon", () => {
  const FORBIDDEN = /Secondary|registration Proof|TrustProduct|EndUser|TCR/i
  const jargon = [
    "TCR rejected the TrustProduct EndUser",
    "Secondary Customer Profile is missing the Business Information EndUser",
    "Trust Product website URL is invalid for the TCR brand",
    "Bundle email is invalid",
    "End User first_name is missing",
  ]

  test("every mapper, every branch", () => {
    const codes = [30893, 30882, 30883, 30884, 30885, 30794, 30799, 30800, 99999, undefined]
    const descriptions = [
      ...jargon,
      "Too many brands registered with this EIN",
      "Tax ID does not match",
      "Website privacy policy TrustProduct is unreachable",
      "",
    ]
    const errors = codes.flatMap((error_code) => descriptions.map((description) => ({ error_code, description })))
    const evaluations = jargon.map((failure_reason) => [{ passed: false, failure_reason }])

    const messages = [
      ...issuesFromBrandErrors(errors),
      ...issuesFromCampaignErrors(errors),
      ...issuesFromBrandErrors([]),
      ...issuesFromCampaignErrors([]),
      ...issuesFromEvaluation([]),
      ...evaluations.flatMap((e) => issuesFromEvaluation(e)),
    ].map((i) => i.message)
    expect(messages.length).toBeGreaterThan(50)
    for (const m of messages) expect(m).not.toMatch(FORBIDDEN)
    for (const m of [CARRIER_DECLINED_MESSAGE, LEGAL_NAME_MISMATCH_MESSAGE, RESUBMISSIONS_EXHAUSTED_MESSAGE]) {
      expect(m).not.toMatch(FORBIDDEN)
    }
  })
})

describe("issuesHash", () => {
  test("is order-independent and changes with content", () => {
    const a = { field: "samples" as const, message: "A", fixable: true }
    const b = { field: "rep" as const, message: "B", fixable: true }
    expect(issuesHash([a, b])).toBe(issuesHash([b, a]))
    expect(issuesHash([a])).not.toBe(issuesHash([b]))
  })
})
