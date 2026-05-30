import { GetAccountCommand, SESv2Client } from "@aws-sdk/client-sesv2"

export type SesAccountHealth = {
  enforcementStatus: string | null
  sendingEnabled: boolean | null
}

type CachedAccountHealth = {
  fetchedAt: number
  health: SesAccountHealth
}

const CACHE_TTL_MS = 60 * 1000
const UNKNOWN_ACCOUNT_HEALTH: SesAccountHealth = {
  enforcementStatus: null,
  sendingEnabled: null,
}

let cachedAccountHealth: CachedAccountHealth | null = null

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

export async function getSesAccountHealth(): Promise<SesAccountHealth> {
  if (cachedAccountHealth && Date.now() - cachedAccountHealth.fetchedAt < CACHE_TTL_MS) {
    return cachedAccountHealth.health
  }

  try {
    const command = new GetAccountCommand({})
    const response = await sesClient.send(command)
    const health: SesAccountHealth = {
      enforcementStatus: response.EnforcementStatus ?? null,
      sendingEnabled: response.SendingEnabled ?? null,
    }

    cachedAccountHealth = {
      fetchedAt: Date.now(),
      health,
    }

    return health
  } catch (err) {
    console.error("Failed to read SES account health", err)
    return UNKNOWN_ACCOUNT_HEALTH
  }
}
