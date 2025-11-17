import { sendEmail } from "./sendfox-service"
import { createLogger } from "@/lib/logger"

const log = createLogger("campaign-sender")

interface EmailOptions {
  to: string
  subject: string
  html: string
  dryRun?: boolean
}

export async function sendEmailCampaign({ to, subject, html, dryRun }: EmailOptions): Promise<string> {
  if (dryRun) {
    log("email", "[DRY RUN]", { to, subject })
    return "dry-run"
  }

  try {
    const data = (await sendEmail(to, subject, html)) as { id?: string }
    log("email", "Sent", { to, id: data?.id })
    return data?.id || ""
  } catch (err) {
    console.error("Failed to send email", err)
    throw err
  }
}
