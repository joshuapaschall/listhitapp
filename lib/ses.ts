import { MessageTag, SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2"

export interface SendSesEmailParams {
  to: string
  subject: string
  html: string
  text?: string
  fromEmail?: string
  fromName?: string
  configurationSetName?: string
  tags?: Record<string, string | null | undefined>
  unsubscribeUrl?: string
}

function createSesClient() {
  const region = process.env.AWS_SES_REGION
  const accessKeyId = process.env.AWS_SES_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SES_SECRET_ACCESS_KEY

  return new SESv2Client({
    region: region || undefined,
    credentials:
      accessKeyId && secretAccessKey
        ? { accessKeyId, secretAccessKey }
        : undefined,
  })
}

const sesClient = createSesClient()

function extractMailbox(address: string) {
  const match = address.match(/<([^>]+)>/)
  return match ? match[1].trim() : address.trim()
}

export async function sendSesEmail(params: SendSesEmailParams) {
  const fromEmail = params.fromEmail || process.env.AWS_SES_FROM_EMAIL
  const configurationSet = params.configurationSetName || process.env.AWS_SES_CONFIGURATION_SET

  if (!fromEmail) {
    throw new Error("AWS SES from email is not configured")
  }

  const disableCustomHeaders = process.env.AWS_SES_DISABLE_CUSTOM_HEADERS === "1"
  const mailbox = extractMailbox(fromEmail)

  const headers: { Name: string; Value: string }[] = []

  const reservedHeaders = new Set([
    "from",
    "to",
    "subject",
    "cc",
    "bcc",
    "reply-to",
    "return-path",
    "message-id",
    "date",
    "content-type",
    "mime-version",
    "content-disposition",
  ])

  let headerUnsubscribeUrl = params.unsubscribeUrl
  if (params.unsubscribeUrl) {
    try {
      const parsed = new URL(params.unsubscribeUrl)
      parsed.pathname = "/api/unsubscribe"
      headerUnsubscribeUrl = parsed.toString()
    } catch (error) {
      console.error("Failed to normalize unsubscribe URL for headers", error)
      headerUnsubscribeUrl = params.unsubscribeUrl
    }
  }

  if (params.unsubscribeUrl && !disableCustomHeaders) {
    const mailto = `mailto:${mailbox}?subject=Unsubscribe`
    const listUnsubscribeUrl = headerUnsubscribeUrl || params.unsubscribeUrl
    headers.push({ Name: "List-Unsubscribe", Value: `<${listUnsubscribeUrl}>, <${mailto}>` })
    headers.push({ Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" })
  }
  const filteredHeaders = disableCustomHeaders
    ? []
    : headers.filter(({ Name }) => !reservedHeaders.has(Name.toLowerCase()))

  const emailTags: MessageTag[] = Object.entries(params.tags || {})
    .filter(([, value]) => Boolean(value))
    .map(([Name, Value]) => ({
      Name,
      Value: String(Value),
    }))

  const commandInput = {
    FromEmailAddress: mailbox,
    Destination: {
      ToAddresses: [params.to],
    },
    Content: {
      Simple: {
        Subject: { Data: params.subject },
        Body: {
          Html: { Data: params.html },
          ...(params.text ? { Text: { Data: params.text } } : {}),
        },
        ...(filteredHeaders.length ? { Headers: filteredHeaders } : {}),
      },
    },
    ...(configurationSet ? { ConfigurationSetName: configurationSet } : {}),
    ...(emailTags.length ? { EmailTags: emailTags } : {}),
  }

  console.debug("Sending SES email", {
    from: commandInput.FromEmailAddress,
    to: commandInput.Destination.ToAddresses,
    subject: commandInput.Content.Simple.Subject.Data,
    configurationSet: commandInput.ConfigurationSetName,
    headers: filteredHeaders.map(({ Name }) => Name),
  })

  const command = new SendEmailCommand(commandInput)

  return sesClient.send(command)
}
