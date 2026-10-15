// Registrar/DNS-host specific instructions for the DNS assistant. Pure data —
// safe on client and server. Steps are short and numbered; the record table
// (Type / Name / Value with copy buttons) is rendered separately, so steps refer
// to "the records below" rather than repeating values.

export type ProviderKey =
  | "godaddy"
  | "namecheap"
  | "cloudflare"
  | "squarespace"
  | "porkbun"
  | "hostinger"
  | "ionos"
  | "wix"
  | "bluehost"
  | "networksolutions"
  | "vercel"
  | "generic"

export type HostFormat = "relative" | "fqdn"

export type StepRecord = { type: string; host: string; value: string }

export interface ProviderGuide {
  label: string
  dnsUrl?: (domain: string) => string
  hostFormat: HostFormat
  steps: (records: StepRecord[]) => string[]
  warnings?: string[]
}

export const KEEP_EMAIL_LINE = "Don't change your MX or email records unless they're listed here. Your email keeps working."

const repeatLine = (records: StepRecord[]) =>
  records.length > 1 ? [`Repeat for each of the ${records.length} records.`] : []

export const PROVIDERS: Record<ProviderKey, ProviderGuide> = {
  godaddy: {
    label: "GoDaddy",
    dnsUrl: (d) => `https://dcc.godaddy.com/control/dnsmanagement?domainName=${encodeURIComponent(d)}`,
    hostFormat: "relative",
    steps: () => [
      "Open your GoDaddy domain DNS page (button above).",
      "Look for an existing record with the same Type and Name. If there is one, click the pencil and edit it. If not, click **Add New Record**.",
      "Copy the Type, Name and Value below exactly. TTL: 1/2 Hour. Click **Save**.",
      "Repeat for each record.",
      "On the **Forwarding** tab, make sure domain forwarding is off.",
    ],
  },
  namecheap: {
    label: "Namecheap",
    dnsUrl: (d) => `https://ap.www.namecheap.com/Domains/DomainControlPanel/${encodeURIComponent(d)}/advancedns`,
    hostFormat: "relative",
    steps: (r) => [
      "Open Namecheap → Domain List → Manage next to your domain → Advanced DNS (button above).",
      "Under Host Records, edit any existing record with the same Type and Host. Otherwise click Add New Record.",
      "Copy the Type, Host and Value below exactly. Leave TTL on Automatic. Click the green check to save.",
      ...repeatLine(r),
      "If you see a URL Redirect Record for the same Host, delete it.",
    ],
  },
  cloudflare: {
    label: "Cloudflare",
    dnsUrl: () => "https://dash.cloudflare.com/",
    hostFormat: "relative",
    steps: (r) => [
      "Open Cloudflare, pick your domain, then go to DNS → Records (button above).",
      "Edit any existing record with the same Type and Name. Otherwise click Add record.",
      "Copy the Type, Name and Value below exactly. Leave TTL on Auto. Click Save.",
      ...repeatLine(r),
    ],
    warnings: ["Set Proxy status to **DNS only** (gray cloud)."],
  },
  squarespace: {
    label: "Squarespace",
    dnsUrl: (d) => `https://account.squarespace.com/domains/managed/${encodeURIComponent(d)}/dns/dns-settings`,
    hostFormat: "relative",
    steps: (r) => [
      "Open Squarespace → Domains → your domain → DNS (button above).",
      "Under Custom records, edit any record with the same Type and Host. Otherwise click Add record.",
      "Copy the Type, Host and Data/Value below exactly. Click Save.",
      ...repeatLine(r),
      "If a Squarespace Defaults preset is using the same Host, remove that preset.",
    ],
  },
  porkbun: {
    label: "Porkbun",
    dnsUrl: () => "https://porkbun.com/account/domainsSpeedy",
    hostFormat: "relative",
    steps: (r) => [
      "Open Porkbun → Domain Management, then click DNS next to your domain (button above).",
      "Delete any existing record with the same Type and Host (including the default ALIAS/parking records on the same Host).",
      "Add a record: copy the Type, Host and Answer/Value below exactly. Click Add.",
      ...repeatLine(r),
    ],
  },
  hostinger: {
    label: "Hostinger",
    dnsUrl: (d) => `https://hpanel.hostinger.com/domain/${encodeURIComponent(d)}/dns`,
    hostFormat: "relative",
    steps: (r) => [
      "Open hPanel → Domains → your domain → DNS / Nameservers (button above).",
      "Under Manage DNS records, delete any existing record with the same Type and Name.",
      "Add a record: copy the Type, Name and Points to/Value below exactly. Click Add Record.",
      ...repeatLine(r),
    ],
  },
  ionos: {
    label: "IONOS",
    dnsUrl: () => "https://my.ionos.com/domains",
    hostFormat: "relative",
    steps: (r) => [
      "Open IONOS → Domains & SSL → the gear next to your domain → DNS (button above).",
      "Edit any existing record with the same Type and Host name. Otherwise click Add record.",
      "Copy the Type, Host name and Value below exactly. Click Save.",
      ...repeatLine(r),
    ],
  },
  wix: {
    label: "Wix",
    dnsUrl: () => "https://manage.wix.com/account/domains",
    hostFormat: "relative",
    steps: (r) => [
      "Open Wix → Domains → the ⋯ next to your domain → Manage DNS Records (button above).",
      "Find the section for the record Type. Edit a record with the same Host name, or click + Add Record.",
      "Copy the Host name and Value below exactly. Click Save.",
      ...repeatLine(r),
    ],
  },
  bluehost: {
    label: "Bluehost",
    dnsUrl: () => "https://my.bluehost.com/hosting/app#/domains",
    hostFormat: "relative",
    steps: (r) => [
      "Open Bluehost → Domains → Settings next to your domain → Advanced Tools → DNS records (button above).",
      "Edit any existing record with the same Type and Host Record. Otherwise click Add Record.",
      "Copy the Type, Host Record and Points To/Value below exactly. Click Save.",
      ...repeatLine(r),
    ],
  },
  networksolutions: {
    label: "Network Solutions",
    dnsUrl: () => "https://www.networksolutions.com/my-account/domain-center",
    hostFormat: "relative",
    steps: (r) => [
      "Open Network Solutions → My Domain Names → your domain → Manage → Advanced DNS (button above).",
      "Edit the record type section (A, CNAME, MX or TXT) and change any entry with the same Host.",
      "Copy the Host and Value below exactly. Click Continue, then Save Changes.",
      ...repeatLine(r),
    ],
  },
  vercel: {
    label: "Vercel",
    dnsUrl: () => "https://vercel.com/dashboard/domains",
    hostFormat: "relative",
    steps: (r) => [
      "Open Vercel → Domains → your domain (button above).",
      "In DNS Records, delete any record with the same Name and Type.",
      "Add a record: copy the Name, Type and Value below exactly. Click Add.",
      ...repeatLine(r),
    ],
  },
  generic: {
    label: "your domain provider",
    hostFormat: "fqdn",
    steps: (r) => [
      "Sign in where you bought your domain (or where its DNS is managed) and open its DNS settings.",
      "Edit any existing record with the same Type and Name. Otherwise add a new record.",
      "Copy the Type, Name and Value below exactly, then save.",
      ...repeatLine(r),
    ],
    warnings: ["If your provider adds your domain to the end of the Name automatically, enter only the part before it."],
  },
}

export function providerGuide(key: string | null | undefined): ProviderGuide {
  return PROVIDERS[(key as ProviderKey) in PROVIDERS ? (key as ProviderKey) : "generic"]
}

// Steps for a provider, always ending with the keep-your-email line.
export function providerSteps(key: string | null | undefined, records: StepRecord[]): string[] {
  return [...providerGuide(key).steps(records), KEEP_EMAIL_LINE]
}

// Steps and warnings may mark words **bold**; plain-text channels strip it.
export function stripBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1")
}

// How the host should be typed at this provider. `zone` is the registrable
// domain (example.com). Most registrars append the zone themselves, so they want
// "@", "www", "bounce" or "abc._domainkey" — not the full name.
export function displayHost(fqdn: string, zone: string, format: HostFormat): string {
  const host = fqdn.toLowerCase().replace(/\.$/, "")
  const z = zone.toLowerCase().replace(/\.$/, "")
  if (format === "fqdn") return host
  if (host === z) return "@"
  if (host.endsWith(`.${z}`)) return host.slice(0, -(z.length + 1))
  return host
}
