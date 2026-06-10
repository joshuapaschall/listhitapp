import type { SiteBusiness } from "./types"

export interface LegalSection {
  heading?: string
  paragraphs: string[]
}
export interface LegalDoc {
  title: string
  intro?: string
  sections: LegalSection[]
}

function fullAddress(b: SiteBusiness): string {
  const cityState = [b.city, b.state].filter(Boolean).join(", ")
  return [b.address, cityState, b.zip].filter(Boolean).join(", ")
}

// Short opt-in disclosure shown on every form and sent to the lead-capture
// endpoint as consent_text. Exact approved short-form language.
export function buildOptInDisclosure(name: string): string {
  return `By submitting your cell phone number you are agreeing to receive automated/promotional Text Messages from ${name}. Message frequency varies. This campaign utilizes promotional marketing. Reply STOP to cancel. For Help reply with 'HELP'. Message and Data Rates May Apply. Terms of Use and Privacy Policy`
}

// Carrier-required two-checkbox consent: one marketing, one non-marketing, each
// naming the legal business and carrying the mandated STOP/HELP + rates language.
// Fixed system wording — never user-configurable.
export function buildConsentTexts(legalName: string): { marketing: string; nonMarketing: string } {
  const name = legalName?.trim() || "us"
  return {
    marketing: `I consent to receive marketing text messages about new property deals, investment opportunities, and list updates from ${name} at the phone number provided. Message frequency may vary. Message & data rates may apply. Text HELP for assistance, reply STOP to opt out.`,
    nonMarketing: `I consent to receive non-marketing text messages from ${name} about replies to my questions and details on properties I ask about. Message frequency may vary. Message & data rates may apply. Text HELP for assistance, reply STOP to opt out.`,
  }
}

// Auto-populated legal-doc inputs. Contact details come from the org so they
// match the A2P application by construction.
export interface LegalArgs {
  legalName: string
  brand?: string
  phone: string
  email: string
  website: string
  address: string
}

// "Legal Name DBA Brand" when a brand differs from the legal name, else the
// legal name alone.
function legalDisplayName(a: LegalArgs): string {
  const brand = a.brand?.trim()
  const legal = a.legalName.trim()
  return brand && brand !== legal ? `${a.legalName} DBA ${a.brand}` : a.legalName
}

// Standalone Privacy Policy — distinct from the Terms page, with the carrier-
// required SMS, data-protection, and non-sharing clauses verbatim.
export function buildPrivacyPolicy(a: LegalArgs): LegalDoc {
  const legalDisplay = legalDisplayName(a)
  const phone = a.phone || "our phone number"
  const email = a.email || "our support email"
  const website = a.website || ""
  const year = new Date().getFullYear()
  return {
    title: "Privacy Policy",
    intro: `${legalDisplay} ("we," "us," or "our") operates ${website} and a text-messaging program for people who join our property buyer list. This policy explains what we collect, how we use it, and your choices. We do not sell, rent, trade, or share your information for anyone else's marketing.`,
    sections: [
      {
        heading: "Information We Collect",
        paragraphs: [
          `Contact information you give us: your name, phone number, email address, and any optional mailing address.`,
          `Opt-in records: the exact consent wording shown to you when you opted in, together with a timestamp of your consent.`,
          `Messaging history: the text messages exchanged between you and us.`,
          `Non-personal data: IP address, browser and device information, usage analytics, and cookies.`,
        ],
      },
      {
        heading: "How We Use Your Information",
        paragraphs: [
          `To operate the buyer list and send you the property deal alerts and updates you opted into.`,
          `To respond to your questions and send details on properties you ask about.`,
          `To keep records of your consent.`,
          `To operate, secure, and improve the site.`,
        ],
      },
      {
        heading: "SMS / Text Messaging",
        paragraphs: [
          `When you join our buyer list and opt in, we send text messages about new property deals, investment opportunities, and buyer-list updates, and we respond to your questions and send details on properties you ask about.`,
          `Opt-in: we only send text messages to people who have explicitly opted in. We keep timestamped records of consent in accordance with the Telephone Consumer Protection Act (TCPA).`,
          `Opt-out: you can opt out at any time by replying STOP, END, CANCEL, UNSUBSCRIBE, or QUIT. We send one confirmation message and then stop sending messages unless you re-join.`,
          `Message frequency varies.`,
          `Help: reply HELP at any time, or contact us at ${email} or ${phone}.`,
          `Message and data rates may apply. Carriers are not liable for delayed or undelivered messages. Supported carriers include AT&T, Verizon, T-Mobile, and other major and regional carriers.`,
        ],
      },
      {
        heading: "SMS Data Protection Statement",
        paragraphs: [
          `No mobile information will be shared with third parties/affiliates for marketing/promotional purposes. Information sharing to subcontractors in support services, such as customer service, is permitted. All other use case categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.`,
        ],
      },
      {
        heading: "Information Sharing & Disclosure",
        paragraphs: [
          `We do not sell, rent, or trade your personal information, and we do not share it with third parties or affiliates for their own marketing.`,
          `We share information only with service providers who operate the program (for example, our messaging provider) solely to deliver the messages you consented to, under confidentiality obligations; when required for legal compliance; and in connection with a business transfer.`,
          `Text-messaging originator opt-in data and consent are excluded from any such sharing and are not shared with any third parties other than the provider delivering the messages you asked to receive.`,
        ],
      },
      {
        heading: "Data Security",
        paragraphs: [
          `We use reasonable administrative, technical, and physical safeguards to protect your information. No method of transmission or storage is 100% secure, however, and we cannot guarantee absolute security.`,
        ],
      },
      {
        heading: "Retention",
        paragraphs: [
          `We retain your information while you participate in the program or as needed to meet our legal obligations.`,
        ],
      },
      {
        heading: "Cookies & Tracking",
        paragraphs: [
          `We use cookies for analytics, to remember your preferences, and to improve the site. You can control cookies through your browser settings.`,
        ],
      },
      {
        heading: "Your Rights & Choices",
        paragraphs: [
          `Consent to receive automated marketing text messages is not a condition of any purchase or of joining the list.`,
          `You can opt out of text messages at any time by replying STOP. You may also request to access, update, or delete your information, or withdraw consent, by contacting us using the details below.`,
        ],
      },
      {
        heading: "Third-Party Links",
        paragraphs: [
          `Our site may link to third-party websites. We are not responsible for the privacy practices of those sites.`,
        ],
      },
      {
        heading: "Changes to This Policy",
        paragraphs: [
          `We may update this policy from time to time. The latest version will always be posted here with its effective date.`,
          `Effective ${year}.`,
        ],
      },
      {
        heading: "Contact Us",
        paragraphs: [
          legalDisplay,
          `Phone: ${phone} · Email: ${email} · Website: ${website}`,
          ...(a.address ? [a.address] : []),
        ],
      },
    ],
  }
}

// Standalone Terms of Service — distinct from the Privacy Policy. Must not grant
// any data-sharing right the Privacy Policy denies.
export function buildTermsOfService(a: LegalArgs): LegalDoc {
  const legalDisplay = legalDisplayName(a)
  const phone = a.phone || "our phone number"
  const email = a.email || "our support email"
  const website = a.website || ""
  const year = new Date().getFullYear()
  return {
    title: "Terms of Service",
    intro: `Effective ${year}.`,
    sections: [
      {
        heading: "SMS Messaging Terms & Compliance",
        paragraphs: [
          `This messaging program is operated by ${legalDisplay}. When you join our buyer list at ${website} and opt in, you agree to receive recurring automated text messages about new property deals, investment opportunities, and buyer-list updates, and replies to questions and details on properties you ask about. Consent to receive automated marketing text messages is not a condition of any purchase.`,
          `Cancellation: text STOP, END, CANCEL, UNSUBSCRIBE, or QUIT at any time. We send one confirmation message and then stop. You can re-join by signing up again.`,
          `Help & support: reply HELP at any time, or contact us at ${email} or ${phone}.`,
          `Carriers are not liable for delayed or undelivered messages.`,
          `Message and data rates may apply, message frequency varies, and you should contact your wireless provider for questions about your plan.`,
          `Supported carriers include AT&T, Verizon, T-Mobile, and other major and regional U.S. carriers.`,
          `You must be 18 or older to opt in.`,
          `If you have any questions regarding privacy, please read our privacy policy: ${website}/privacy`,
          `This program is operated in compliance with the TCPA and CTIA messaging principles and guidelines.`,
        ],
      },
      {
        heading: "General Terms",
        paragraphs: [
          `This site is owned and operated by ${legalDisplay}. By using the site you agree to these Terms and to our Privacy Policy.`,
          `We may update these Terms from time to time; the current version is always posted here.`,
          `The materials on this site are our property and are provided for your personal, non-commercial use.`,
          `The site is provided "as is" without warranties of any kind, to the fullest extent permitted by law.`,
          `These Terms are governed by the laws of the state in which the business operates.`,
        ],
      },
      {
        heading: "Contact",
        paragraphs: [
          `${legalDisplay} · Phone: ${phone} · Email: ${email} · Website: ${website}`,
        ],
      },
    ],
  }
}

export function buildContactDoc(name: string, b: SiteBusiness): LegalDoc {
  const rows: string[] = []
  if (b.phone) rows.push(`Phone: ${b.phone}`)
  if (b.email) rows.push(`Email: ${b.email}`)
  const addr = fullAddress(b)
  if (addr) rows.push(`Address: ${addr}`)
  return {
    title: `Contact ${name}`,
    intro: "Have a question about a deal or about joining the list? Reach out and we'll get right back to you.",
    sections: [{ paragraphs: rows.length ? rows : ["Contact details coming soon."] }],
  }
}
