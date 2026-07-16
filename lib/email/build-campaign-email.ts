import { renderTemplate } from "@/lib/utils"
import { appendUnsubscribeFooter } from "@/lib/unsubscribe"
import { htmlToText } from "@/lib/email/html-to-text"
import type { UserMergeContext } from "@/lib/user-context"

export interface BuildCampaignEmailInput {
  rawSubject: string
  rawHtml: string
  buyer: { fname?: string | null; lname?: string | null; phone?: string | null; email?: string | null }
  senderContext?: UserMergeContext
  unsubscribeUrl: string
  physicalAddress: string
}

export interface BuiltCampaignEmail {
  subject: string
  html: string
  text: string
}

/**
 * The single per-recipient email assembly used by BOTH the production queue
 * worker (`processEmailQueue`) and the "Send test email" route. Keeping this in
 * one place guarantees a test send is byte-for-byte identical to the real blast.
 *
 * Steps run in the exact order `processEmailQueue` uses:
 *   1. render the subject merge tags
 *   2. render the html merge tags
 *   3. append the CAN-SPAM / unsubscribe footer
 *   4. derive the text/plain part from the FOOTERED html
 *
 * Pure function — no I/O, no Supabase, no env reads. `linkifyHtml` and
 * `stampBusinessAddressForCampaign` run once per campaign (at queue time), not
 * per recipient, so they are intentionally kept outside this builder.
 */
export function buildCampaignEmail(input: BuildCampaignEmailInput): BuiltCampaignEmail {
  const { rawSubject, rawHtml, buyer, senderContext, unsubscribeUrl, physicalAddress } = input

  const subject = renderTemplate(rawSubject, buyer, senderContext)
  let html = renderTemplate(rawHtml, buyer, senderContext)
  html = appendUnsubscribeFooter(html, { unsubscribeUrl, physicalAddress })
  const text = htmlToText(html)

  return { subject, html, text }
}
