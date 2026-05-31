import { PERMISSION_KEYS, type PermissionKey } from "./keys"

export type PermissionTemplateId = "admin" | "manager" | "agent" | "viewer" | "custom"

export type PermissionTemplate = Readonly<{
  id: PermissionTemplateId
  label: string
  description: string
  grants: readonly PermissionKey[]
}>

const allExcept = (excluded: readonly PermissionKey[]): PermissionKey[] =>
  PERMISSION_KEYS.filter((key) => !excluded.includes(key))

export const PERMISSION_TEMPLATES = Object.freeze([
  {
    id: "admin",
    label: "Admin",
    description: "Full access to every permission. Admin-role users also bypass permission checks automatically.",
    grants: PERMISSION_KEYS,
  },
  {
    id: "manager",
    label: "Manager",
    description: "Broad operational access without user administration or buyer export access.",
    grants: allExcept(["users.manage", "buyers.export"]),
  },
  {
    id: "agent",
    label: "Agent",
    description: "Core buyer, inbox, calling, showing, offer, and campaign visibility access.",
    grants: [
      "buyers.view",
      "buyers.edit",
      "inbox.view",
      "inbox.send",
      "calls.make_receive",
      "properties.view",
      "showings.view",
      "showings.manage",
      "offers.view",
      "offers.manage",
      "campaigns.view",
    ],
  },
  {
    id: "viewer",
    label: "Viewer",
    description: "Read-only access to viewable areas without write, send, export, or delete permissions.",
    grants: [
      "buyers.view",
      "campaigns.view",
      "inbox.view",
      "properties.view",
      "offers.view",
      "showings.view",
    ],
  },
  {
    id: "custom",
    label: "Custom",
    description: "Blank slate with no permissions granted by default.",
    grants: [],
  },
] as const satisfies readonly PermissionTemplate[])

export function grantsForTemplate(id: PermissionTemplateId): PermissionKey[] {
  return [...(PERMISSION_TEMPLATES.find((template) => template.id === id)?.grants ?? [])]
}
