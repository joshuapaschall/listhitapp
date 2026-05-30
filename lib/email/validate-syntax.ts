export function isValidEmailSyntax(email: string): boolean {
  const trimmed = email.trim()
  if (!trimmed || /\s/.test(trimmed)) return false
  if (trimmed.includes("..")) return false

  const parts = trimmed.split("@")
  if (parts.length !== 2) return false

  const [local, domain] = parts
  if (!local || !domain) return false
  if (!domain.includes(".")) return false

  const domainLabels = domain.split(".")
  if (domainLabels.some((label) => !label)) return false

  const finalLabel = domainLabels[domainLabels.length - 1]
  if (finalLabel.length < 2) return false

  return true
}
