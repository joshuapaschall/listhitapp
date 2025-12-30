import { formatFromEmailAddress } from "../lib/ses"

describe("formatFromEmailAddress", () => {
  const originalFromEmail = process.env.AWS_SES_FROM_EMAIL
  const originalFromName = process.env.AWS_SES_FROM_NAME

  afterEach(() => {
    process.env.AWS_SES_FROM_EMAIL = originalFromEmail
    process.env.AWS_SES_FROM_NAME = originalFromName
  })

  test("uses env display name when provided", () => {
    process.env.AWS_SES_FROM_EMAIL = "support@listhit.io"
    process.env.AWS_SES_FROM_NAME = "ListHit"

    const result = formatFromEmailAddress({})

    expect(result.fromEmailAddress).toBe("ListHit <support@listhit.io>")
    expect(result.mailbox).toBe("support@listhit.io")
  })

  test("falls back to mailbox when no display name is available", () => {
    process.env.AWS_SES_FROM_EMAIL = "support@listhit.io"
    delete process.env.AWS_SES_FROM_NAME

    const result = formatFromEmailAddress({})

    expect(result.fromEmailAddress).toBe("support@listhit.io")
    expect(result.mailbox).toBe("support@listhit.io")
  })

  test("strips CRLF characters from name and email", () => {
    process.env.AWS_SES_FROM_EMAIL = "support@listhit.io\r\n"
    process.env.AWS_SES_FROM_NAME = "List\r\nHit"

    const result = formatFromEmailAddress({})

    expect(result.fromEmailAddress).toBe("ListHit <support@listhit.io>")
    expect(result.mailbox).toBe("support@listhit.io")
  })
})
