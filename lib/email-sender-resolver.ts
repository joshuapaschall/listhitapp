import "server-only"

import { createLogger } from "@/lib/logger"
import { supabaseAdmin } from "@/lib/supabase/admin"

type SenderSource = "campaign" | "org_default" | "env"

type RequestedSender = {
  fromEmail?: string | null
  fromName?: string | null
}

type ResolvedSender = {
  fromEmail: string
  fromName?: string
  replyTo?: string
  source: SenderSource
}

type EmailDomainRow = {
  id: string
  domain: string
  status: string | null
}

type EmailSenderRow = {
  from_email: string
  from_name: string | null
  reply_to: string | null
  domain_id: string
}

const log = createLogger("email-sender-resolver")

export class SenderNotVerifiedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SenderNotVerifiedError"
  }
}

function normalizeEmail(value?: string | null) {
  const normalized = value?.trim().toLowerCase()
  return normalized || undefined
}

function normalizeOptional(value?: string | null) {
  const normalized = value?.trim()
  return normalized || undefined
}

function getDomainPart(email: string) {
  const domain = email.split("@").pop()?.trim().toLowerCase()
  return domain || undefined
}

async function getVerifiedDomain(domainPart: string) {
  const { data, error } = await supabaseAdmin
    .from("email_domains")
    .select("id,domain,status")
    .eq("domain", domainPart)
    .maybeSingle<EmailDomainRow>()

  if (error) {
    log("domain lookup failed", { domain: domainPart, error: error.message })
    throw error
  }

  return data?.status === "verified" ? data : null
}

async function getSenderByEmail(orgId: string | null, fromEmail: string) {
  let query = supabaseAdmin
    .from("email_senders")
    .select("from_email,from_name,reply_to,domain_id")
    .eq("from_email", fromEmail)

  if (orgId) {
    query = query.eq("org_id", orgId)
  }

  const { data, error } = await query.maybeSingle<EmailSenderRow>()

  if (error) {
    log("sender lookup failed", { orgScoped: Boolean(orgId), error: error.message })
    throw error
  }

  return data
}

async function getOrgDefaultSender(orgId: string) {
  const { data: sender, error } = await supabaseAdmin
    .from("email_senders")
    .select("from_email,from_name,reply_to,domain_id")
    .eq("org_id", orgId)
    .eq("is_default", true)
    .maybeSingle<EmailSenderRow>()

  if (error) {
    log("default sender lookup failed", { error: error.message })
    throw error
  }

  if (!sender) {
    return null
  }

  const { data: domain, error: domainError } = await supabaseAdmin
    .from("email_domains")
    .select("id,domain,status")
    .eq("id", sender.domain_id)
    .maybeSingle<EmailDomainRow>()

  if (domainError) {
    log("default sender domain lookup failed", { error: domainError.message })
    throw domainError
  }

  return domain?.status === "verified" ? sender : null
}

export async function resolveCampaignSender(
  orgId: string | null,
  requested: RequestedSender,
): Promise<ResolvedSender> {
  const requestedFromEmail = normalizeEmail(requested.fromEmail)
  const requestedFromName = normalizeOptional(requested.fromName)

  if (requestedFromEmail) {
    const domainPart = getDomainPart(requestedFromEmail)

    if (!domainPart || !(await getVerifiedDomain(domainPart))) {
      throw new SenderNotVerifiedError(
        `The sender domain "${domainPart || requestedFromEmail}" isn't verified. Verify it under Settings → Sending Domains before sending.`,
      )
    }

    const sender = await getSenderByEmail(orgId, requestedFromEmail)

    return {
      fromEmail: requestedFromEmail,
      fromName: requestedFromName ?? normalizeOptional(sender?.from_name),
      replyTo: normalizeEmail(sender?.reply_to),
      source: "campaign",
    }
  }

  if (orgId) {
    const defaultSender = await getOrgDefaultSender(orgId)

    if (defaultSender) {
      return {
        fromEmail: defaultSender.from_email,
        fromName: normalizeOptional(defaultSender.from_name),
        replyTo: normalizeEmail(defaultSender.reply_to),
        source: "org_default",
      }
    }
  }

  const envFromEmail = normalizeEmail(process.env.AWS_SES_FROM_EMAIL)
  if (envFromEmail) {
    return {
      fromEmail: envFromEmail,
      fromName: normalizeOptional(process.env.AWS_SES_FROM_NAME),
      replyTo: undefined,
      source: "env",
    }
  }

  throw new SenderNotVerifiedError("No verified sender is configured.")
}
