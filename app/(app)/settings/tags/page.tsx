import { PermissionGate } from "@/components/auth/PermissionGate"

import TagsManager from "./tags-manager"

export default function TagsSettingsPage() {
  return (
    <PermissionGate permission="settings.tags" title="Tags">
      <TagsManager />
    </PermissionGate>
  )
}
