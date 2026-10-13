import { NextResponse } from "next/server"

import { apiError } from "@/lib/api-error"
import { requireOrgContext } from "@/lib/auth/org-context"
import { hasPermission } from "@/lib/permissions/server"
import { isOrgTelnyxPinnedEnv } from "@/lib/providers/sms/routing"
import { supabaseAdmin } from "@/lib/supabase"

export const dynamic = "force-dynamic"

type SenderOption = {
  id: string
  fromEmail: string
  fromName: string | null
  replyTo: string | null
  isDefault: boolean
}

type SenderRow = {
  id: string
  from_email: string
  from_name: string | null
  reply_to: string | null
  is_default: boolean | null
  email_domains: { status: string | null } | { status: string | null }[] | null
}

function domainStatus(row: SenderRow) {
  const domain = Array.isArray(row.email_domains) ? row.email_domains[0] : row.email_domains
  return domain?.status ?? null
}

// Any composer (1:1 email, campaigns) picks its From from this list, so it is
// gated on the ability to send email rather than on managing sending domains.
export async function GET() {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Organization context missing" }, { status: 403 })

  const allowed =
    (await hasPermission(supabase, "inbox.send")) ||
    (await hasPermission(supabase, "campaigns.send_email"))
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden", missingPermission: "inbox.send" }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from("email_senders")
    .select("id,from_email,from_name,reply_to,is_default,email_domains!inner(status)")
    .eq("org_id", orgId)
    .eq("email_domains.status", "verified")
    .order("is_default", { ascending: false })
    .order("from_email", { ascending: true })
  if (error) return apiError(error, 500)

  const senders: SenderOption[] = ((data || []) as SenderRow[])
    .filter((row) => domainStatus(row) === "verified")
    .map((row) => ({
      id: row.id,
      fromEmail: row.from_email,
      fromName: row.from_name ?? null,
      replyTo: row.reply_to ?? null,
      isDefault: Boolean(row.is_default),
    }))

  // The platform operator's own env address is only ever offered to the owner org.
  const envFromEmail = process.env.AWS_SES_FROM_EMAIL?.trim()
  if (isOrgTelnyxPinnedEnv(orgId) && envFromEmail) {
    const duplicate = senders.some((s) => s.fromEmail.toLowerCase() === envFromEmail.toLowerCase())
    if (!duplicate) {
      senders.push({
        id: "owner-env",
        fromEmail: envFromEmail,
        fromName: process.env.AWS_SES_FROM_NAME ?? null,
        replyTo: null,
        isDefault: senders.length === 0,
      })
    }
  }

  return NextResponse.json({ senders })
}
