import { GetAccountCommand, SESv2Client } from "@aws-sdk/client-sesv2"

type SesQuota = {
  max24HourSend: number
  maxSendRate: number
  sentLast24Hours: number
}

type CachedQuota = {
  fetchedAt: number
  quota: SesQuota
}

const CACHE_TTL_MS = 60 * 1000

let cachedQuota: CachedQuota | null = null

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

export async function getSesQuota(): Promise<SesQuota> {
  if (cachedQuota && Date.now() - cachedQuota.fetchedAt < CACHE_TTL_MS) {
    return cachedQuota.quota
  }

  const command = new GetAccountCommand({})
  const response = await sesClient.send(command)
  const quota = response.SendQuota

  const max24HourSend = Number(quota?.Max24HourSend ?? 0)
  const maxSendRate = Number(quota?.MaxSendRate ?? 0)
  const sentLast24Hours = Number(quota?.SentLast24Hours ?? 0)

  const normalized: SesQuota = {
    max24HourSend,
    maxSendRate,
    sentLast24Hours,
  }

  cachedQuota = {
    fetchedAt: Date.now(),
    quota: normalized,
  }

  return normalized
}
