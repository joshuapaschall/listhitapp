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

  const fromAddress = fromName ? `${fromName} <${fromEmail}>` : fromEmail
  const emailTags: MessageTag[] = Object.entries(params.tags || {})
    .filter(([, value]) => Boolean(value))
    .map(([Name, Value]) => ({
      Name,
      Value: String(Value),
    }))

  const command = new SendEmailCommand({
    FromEmailAddress: fromAddress,
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
      },
    },
    ...(configurationSet ? { ConfigurationSetName: configurationSet } : {}),
    ...(emailTags.length ? { EmailTags: emailTags } : {}),
  })

  return sesClient.send(command)
}
