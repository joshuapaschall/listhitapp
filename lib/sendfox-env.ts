export function getSendfoxToken() {
  return process.env.SENDFOX_API_TOKEN || process.env.SENDFOX_API_KEY || ""
}
