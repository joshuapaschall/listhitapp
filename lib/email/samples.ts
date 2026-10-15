// Every transactional template rendered with realistic sample data. Used by the
// admin email-preview page and by the tests that guard escaping and wording.

import { buildAuthTemplates } from "@/lib/email/auth-templates"
import { brandFromIdentity } from "@/lib/email-templates/brand"
import { orgIdentityFromRow } from "@/lib/org-identity"
import { providerSteps, stripBold } from "@/lib/dns/providers"
import {
  accountReadyEmail,
  actionNeededEmail,
  adminAwaitingApprovalEmail,
  dnsShareEmail,
  emailReadyEmail,
  inviteEmail,
  offerEmail,
  passwordResetEmail,
  showingEmail,
  textingLiveEmail,
  websiteLiveEmail,
  type RenderedEmail,
} from "@/lib/email/templates"

export type SampleEmail = RenderedEmail & { key: string; name: string; audience: "customer" | "admin" | "buyer" | "auth" }

const BUSINESS = "Every State House Buyers"

const tenantIdentity = orgIdentityFromRow({
  name: "Every State House Buyers",
  business_name: BUSINESS,
  address_line1: "1450 Peachtree St NE",
  address_line2: "Suite 200",
  city: "Atlanta",
  state: "GA",
  zip: "30309",
  phone: "+14045550100",
  website_url: "https://everystatehousebuyers.com",
})

export function sampleEmails(): SampleEmail[] {
  const brand = { ...brandFromIdentity(tenantIdentity), colors: { ...brandFromIdentity(tenantIdentity).colors, navy: "#0F766E" } }
  const records = [
    { type: "A", host: "@", value: "76.76.21.21" },
    { type: "CNAME", host: "www", value: "cname.vercel-dns.com" },
  ]
  const list: SampleEmail[] = [
    { key: "texting-live", name: "Texting is live", audience: "customer", ...textingLiveEmail({ firstName: "Josh", phoneNumber: "+14045550123", approvedAt: "2026-10-15T15:00:00Z", business: BUSINESS }) },
    { key: "action-one", name: "Action needed (one fix)", audience: "customer", ...actionNeededEmail({ issues: ["Your legal business name must match your IRS EIN letter (CP 575) exactly, including LLC or Inc."], business: BUSINESS }) },
    {
      key: "action-many",
      name: "Action needed (several fixes)",
      audience: "customer",
      ...actionNeededEmail({
        issues: ["Check your business address. (The street address could not be found.)", "Your sample messages need changes before the carriers will approve them."],
        business: BUSINESS,
      }),
    },
    {
      key: "admin-approval",
      name: "Admin: awaiting approval",
      audience: "admin",
      ...adminAwaitingApprovalEmail({
        orgId: "00000000-0000-4000-8000-000000000001",
        workspace: "Every State",
        business: "Every State House Buyers LLC",
        typeLabel: "Standard · EIN ending 4821",
        website: "https://everystatehousebuyers.com",
        websiteOk: true,
        estimatedCost: "~$59.00 one-time + ~$11.15/mo",
      }),
    },
    { key: "website-live", name: "Website live", audience: "customer", ...websiteLiveEmail({ domain: "everystatehousebuyers.com", business: BUSINESS }) },
    { key: "email-ready", name: "Email sending ready", audience: "customer", ...emailReadyEmail({ domain: "everystatehousebuyers.com", fromAddress: "deals@everystatehousebuyers.com", business: BUSINESS }) },
    {
      key: "dns-share",
      name: "DNS share",
      audience: "customer",
      ...dnsShareEmail({
        domain: "everystatehousebuyers.com",
        businessName: BUSINESS,
        providerLabel: "GoDaddy",
        steps: providerSteps("godaddy", records).map(stripBold),
        records,
        note: "Can you add these today? Thanks!",
        senderName: "Josh Paschall",
      }),
    },
    { key: "invite", name: "Invite", audience: "customer", ...inviteEmail({ orgName: BUSINESS, inviteUrl: "https://app.listhit.io/set-password?token=sample", inviterName: "Josh Paschall" }) },
    { key: "password-reset", name: "Password reset", audience: "customer", ...passwordResetEmail({ orgName: BUSINESS, resetUrl: "https://app.listhit.io/set-password?token=sample" }) },
    { key: "account-ready", name: "Account ready", audience: "customer", ...accountReadyEmail({ orgName: BUSINESS, signInUrl: "https://app.listhit.io/login" }) },
    {
      key: "showing-confirmed",
      name: "Buyer: showing confirmed",
      audience: "buyer",
      ...showingEmail({ brand, address: tenantIdentity.addressSingleLine, kind: "confirmed", buyerFirstName: "Maria", propertyAddress: "2210 Oak Ridge Dr, Decatur, GA", when: "Oct 20, 2026, 3:00 PM" }),
    },
    {
      key: "showing-reminder",
      name: "Buyer: showing reminder",
      audience: "buyer",
      ...showingEmail({ brand, address: tenantIdentity.addressSingleLine, kind: "reminder", buyerFirstName: "Maria", propertyAddress: "2210 Oak Ridge Dr, Decatur, GA", when: "Oct 20, 2026, 3:00 PM" }),
    },
    {
      key: "offer-accepted",
      name: "Buyer: offer accepted",
      audience: "buyer",
      ...offerEmail({
        brand,
        address: tenantIdentity.addressSingleLine,
        subject: "Offer Accepted — 2210 Oak Ridge Dr",
        title: "Offer Accepted",
        message: "Great news, Maria! Your offer of $185,000 on 2210 Oak Ridge Dr has been accepted! We'll be in touch with next steps.",
        propertyAddress: "2210 Oak Ridge Dr, Decatur, GA",
        offerPrice: "$185,000",
        offerType: "Cash",
        tone: "success",
      }),
    },
  ]
  for (const t of buildAuthTemplates()) {
    list.push({ key: `auth-${t.file.replace(/\.html$/, "")}`, name: `Supabase: ${t.subject}`, audience: "auth", subject: t.subject, html: t.html, text: "(Supabase sends the HTML version only.)" })
  }
  return list
}
