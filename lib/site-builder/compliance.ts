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

// Single combined Terms of Use & Privacy Policy, served at BOTH /terms and
// /privacy. Verbatim approved TCPA language; only business name, support email,
// phone, and address are interpolated.
export function buildTermsAndPrivacy(name: string, b: SiteBusiness): LegalDoc {
  const email = b.email || "our support email"
  const phone = b.phone || "our phone number"
  const addr = fullAddress(b)
  return {
    title: "Terms of Use and Privacy Policy",
    intro: "For Telemarketing and Text Message Purposes",
    sections: [
      {
        paragraphs: [
          `Telemarketing and Text Message Terms of Service and Privacy Policy are intended to supplement the provisions of the General Terms of Service and Privacy Policy specifically with respect to Telemarketing & Text Messaging (SMS and MMS) where you have provided "prior express written consent" within the meaning of the Telephone Consumer Protection Act ("TCPA"), you consent to receive telephone calls, including artificial voice calls, pre-recorded messages and/or calls delivered via automated technology and TEXT/SMS messages. Telephone number(s) that you provide are not required to provide this consent to obtain access, request info or purchase our product.`,
          `Telemarketing and Text Message Terms of Service and Privacy Policy will not limit, supersede or override the General Terms of Service and Privacy Policy, and should be interpreted accordingly. In the event of a conflict between the Telemarketing and Text Message Terms of Service and Privacy Policy and the General Terms of Service and Privacy Policy, the Telemarketing and Text Message Terms of Service and Privacy Policy shall prevail with respect to issues specific to text messaging & telemarketing. For the avoidance of doubt, if there are terms and conditions in the General Terms of Service and Privacy Policy regarding subjects on which the Telemarketing and Text Message Terms of Service and Privacy Policy are silent, such silence will not constitute a conflict and the terms and conditions in the General Terms of Service and Privacy Policy will control in those situations.`,
          `When you opt-in to the service, we will send you an SMS message to confirm your signup.`,
          `This service is used to send you notifications about the status of your account or service, for scheduling appointments, to provide customer support, communicate product or feature announcements, or to send you promotional offers about our products and services even if your mobile number is registered on any state or federal do-not-call list.`,
          `Overall message frequency varies and depends on account activity. However, text messages that are promotional in nature will be limited to 4 or less text messages per month. Promotional Text messages may include coupons, offers, upgrades, and new plans that we believe you may be interested in.`,
          `You can cancel and opt out of future text messages, subscriptions and service at any time by texting one of the following words 'STOP', 'END', 'CANCEL', 'QUIT', 'OPT OUT', 'UNSUBSCRIBE'. After you send the message 'STOP', 'END', 'CANCEL', 'QUIT', 'OPT OUT', 'UNSUBSCRIBE' to us, we will send you a reply message to confirm that you have been unsubscribed. After this, you will no longer receive messages from us. If you want to join again, just text us 'Join', 'Resume' 'Start' or 'Opt In', or follow the instructions in the unsubscribe message or sign up as you did the first time, and we will start sending messages to you again.`,
          `You may be provided in the unsubscribe confirmation with an option to unsubscribe for promotional offers only but continue to get text messages regarding account activities and notices. If you have chosen this option, please follow the instructions in the unsubscribe text message to unsubscribe to just promotional text messages.`,
          `If at any time you forget what keywords are supported, just text us 'HELP' or 'INFO'. After you send the message 'HELP' or 'INFO' to us, we will respond with instructions on how to use our service as well as how to unsubscribe.`,
          `Neither ${name} or the mobile network operators are liable for delayed or undelivered messages.`,
          `We have a right to modify any telephone or short code we use to operate the service at any time. However, if this happens, ${name} will be clearly communicated in the text message and all the terms herein apply. In other words, you're opting in to receive text messages from ${name}, not from a specific sender ID or phone number. Your right to manage the type and frequency of messages will apply to all messages sent from ${name} to you regardless of the sender ID or phone number the messages are sent from.`,
          `As always, Message and Data Rates May Apply for any messages sent to you from us and to us from you. If you have any questions about your text plan or data plan, it is best to contact your wireless provider. For all questions about the services provided by this text messaging program, you can send an email to: ${email}.`,
          `Opt-in data and consent for text messaging will not be shared with any third parties except with technology partners for the purpose of enabling and operating our telemarketing & text messaging program (i.e., facilitating the sending and receiving of text messages).`,
        ],
      },
      {
        heading: "Contacting Us",
        paragraphs: [
          `If there are any questions regarding this Terms of Use and Privacy Policy you may contact us at ${email} or Call Us at ${phone}.`,
          name,
          ...(addr ? [addr] : []),
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
