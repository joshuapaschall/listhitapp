export function getSendfoxToken() {
  const canonicalToken = process.env.SENDFOX_API_TOKEN
  const deprecatedToken = process.env.SENDFOX_API_KEY

  return canonicalToken || deprecatedToken || ""
}
