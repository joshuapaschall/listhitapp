export type PermissionGroup =
  | "Buyers"
  | "Campaigns"
  | "Inbox"
  | "Gmail"
  | "Calling"
  | "Properties"
  | "Offers"
  | "Showings"
  | "Settings"
  | "Admin"

export type PermissionCatalogEntry = Readonly<{
  key: string
  label: string
  group: PermissionGroup
  description: string
}>

export const PERMISSION_CATALOG = Object.freeze([
  {
    key: "buyers.view",
    label: "View buyers",
    group: "Buyers",
    description: "View buyer records, saved filters, and buyer details.",
  },
  {
    key: "buyers.edit",
    label: "Edit buyers",
    group: "Buyers",
    description: "Create and update buyer records, notes, tags, and buyer metadata.",
  },
  {
    key: "buyers.import",
    label: "Import buyers",
    group: "Buyers",
    description: "Import buyer records from CSV files and bulk import workflows.",
  },
  {
    key: "buyers.export",
    label: "Export buyers",
    group: "Buyers",
    description: "Export buyer records and filtered buyer lists.",
  },
  {
    key: "buyers.delete",
    label: "Delete buyers",
    group: "Buyers",
    description: "Delete buyer records from the CRM.",
  },
  {
    key: "campaigns.view",
    label: "View campaigns",
    group: "Campaigns",
    description: "View SMS and email campaign lists, details, and reporting.",
  },
  {
    key: "campaigns.send_sms",
    label: "Send SMS campaigns",
    group: "Campaigns",
    description: "Create and send outbound SMS campaigns.",
  },
  {
    key: "campaigns.send_email",
    label: "Send email campaigns",
    group: "Campaigns",
    description: "Create and send outbound email campaigns.",
  },
  {
    key: "inbox.view",
    label: "View inbox",
    group: "Inbox",
    description: "View SMS inbox conversations and message history.",
  },
  {
    key: "inbox.send",
    label: "Send inbox messages",
    group: "Inbox",
    description: "Send SMS replies and outbound messages through the inbox.",
  },
  {
    key: "gmail.access",
    label: "Access Gmail",
    group: "Gmail",
    description: "Use the full Gmail send, reply, archive, and delete surface.",
  },
  {
    key: "calls.make_receive",
    label: "Make and receive calls",
    group: "Calling",
    description: "Place outbound calls and receive inbound calls.",
  },
  {
    key: "calls.recordings",
    label: "Access call recordings",
    group: "Calling",
    description: "View and manage call recordings.",
  },
  {
    key: "properties.view",
    label: "View properties",
    group: "Properties",
    description: "View property records and property details.",
  },
  {
    key: "properties.manage",
    label: "Create, edit, and delete properties",
    group: "Properties",
    description: "Create, edit, and delete property records.",
  },
  {
    key: "offers.view",
    label: "View offers",
    group: "Offers",
    description: "View offer records and offer details.",
  },
  {
    key: "offers.manage",
    label: "Create, edit, and delete offers",
    group: "Offers",
    description: "Create, edit, and delete offers.",
  },
  {
    key: "showings.view",
    label: "View showings",
    group: "Showings",
    description: "View scheduled showings and showing details.",
  },
  {
    key: "showings.manage",
    label: "Schedule and manage showings",
    group: "Showings",
    description: "Schedule, edit, and manage property showings.",
  },
  {
    key: "settings.markets",
    label: "Manage market settings",
    group: "Settings",
    description: "Manage markets and market-related configuration.",
  },
  {
    key: "settings.templates",
    label: "Manage templates",
    group: "Settings",
    description: "Manage SMS, email, and quick-reply templates.",
  },
  {
    key: "settings.integrations",
    label: "Manage integrations",
    group: "Settings",
    description: "Configure external integrations and connected services.",
  },
  {
    key: "settings.email_domains",
    label: "Manage email domains",
    group: "Settings",
    description: "Configure sender identities, domains, and email deliverability settings.",
  },
  {
    key: "users.manage",
    label: "Manage users",
    group: "Admin",
    description: "Invite, update, and remove users and their permissions.",
  },
] as const satisfies readonly PermissionCatalogEntry[])

export const PERMISSION_KEYS = Object.freeze(
  PERMISSION_CATALOG.map((permission) => permission.key)
) as readonly (typeof PERMISSION_CATALOG)[number]["key"][]

export type PermissionKey = (typeof PERMISSION_KEYS)[number]

export const PERMISSION_GROUPS = Object.freeze([
  "Buyers",
  "Campaigns",
  "Inbox",
  "Gmail",
  "Calling",
  "Properties",
  "Offers",
  "Showings",
  "Settings",
  "Admin",
] as const satisfies readonly PermissionGroup[])

const PERMISSION_KEY_SET = new Set<string>(PERMISSION_KEYS)

export function isPermissionKey(key: string): key is PermissionKey {
  return PERMISSION_KEY_SET.has(key)
}
