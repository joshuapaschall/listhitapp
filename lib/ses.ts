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

export async function sendSesEmail(params: SendSesEmailParams) {
  const fromEmail = params.fromEmail || process.env.AWS_SES_FROM_EMAIL
  const fromName = params.fromName || process.env.AWS_SES_FROM_NAME
  const configurationSet = params.configurationSetName || process.env.AWS_SES_CONFIGURATION_SET

  if (!fromEmail) {
    throw new Error("AWS SES from email is not configured")
  }

  const displayFrom = fromName ? `${fromName} <${fromEmail}>` : fromEmail
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

  if (params.unsubscribeUrl) {
    const mailto = `mailto:${fromEmail}?subject=Unsubscribe`
    headers.push({ Name: "List-Unsubscribe", Value: `<${params.unsubscribeUrl}>, <${mailto}>` })
    headers.push({ Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" })
  }
  const filteredHeaders = headers.filter(({ Name }) => !reservedHeaders.has(Name.toLowerCase()))

  const emailTags: MessageTag[] = Object.entries(params.tags || {})
    .filter(([, value]) => Boolean(value))
    .map(([Name, Value]) => ({
      Name,
      Value: String(Value),
    }))

  const commandInput = {
    FromEmailAddress: displayFrom,
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
