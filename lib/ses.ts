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

  if (fromName) {
    headers.push({ Name: "From", Value: displayFrom })
  }

  if (params.unsubscribeUrl) {
    const mailto = `mailto:${fromEmail}?subject=Unsubscribe`
    headers.push({ Name: "List-Unsubscribe", Value: `<${params.unsubscribeUrl}>, <${mailto}>` })
    headers.push({ Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" })
  }
  const emailTags: MessageTag[] = Object.entries(params.tags || {})
    .filter(([, value]) => Boolean(value))
    .map(([Name, Value]) => ({
      Name,
      Value: String(Value),
    }))

  const command = new SendEmailCommand({
    FromEmailAddress: fromEmail,
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
        ...(headers.length ? { Headers: headers } : {}),
      },
    },
    ...(configurationSet ? { ConfigurationSetName: configurationSet } : {}),
    ...(emailTags.length ? { EmailTags: emailTags } : {}),
  })

  return sesClient.send(command)
}
