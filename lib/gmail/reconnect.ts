import { NextResponse } from "next/server"

export const GMAIL_RECONNECT_MESSAGE =
  "Gmail needs to be reconnected — your access expired or scopes changed."

// Auth/scope failures that are fixed by re-running the OAuth consent:
// insufficient scope (403), invalid_grant / expired refresh (401), and the
// generic messages our gmail helpers throw for those conditions.
const RECONNECT_PATTERNS =
  /ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficientPermissions|invalid_grant|invalid grant|invalid token|Failed to authenticate with Gmail|Failed to refresh Gmail token/i

/**
 * Detect a thrown error (from gmail-api / gmail-tokens or the googleapis client)
 * that means the connected Gmail account must be reconnected.
 */
export function isGmailReconnectError(err: unknown): boolean {
  if (!err) return false
  const anyErr = err as any

  const reason = anyErr?.response?.data?.error?.errors?.[0]?.reason
  if (reason === "insufficientPermissions" || reason === "authError") return true

  const statusDetail = anyErr?.response?.data?.error?.status
  if (statusDetail === "PERMISSION_DENIED" || statusDetail === "UNAUTHENTICATED") return true

  if (anyErr?.response?.status === 401) return true

  const message = typeof anyErr?.message === "string" ? anyErr.message : ""
  const data = anyErr?.response?.data
  const dataStr = typeof data === "string" ? data : data ? JSON.stringify(data) : ""
  return RECONNECT_PATTERNS.test(message) || RECONNECT_PATTERNS.test(dataStr)
}

/**
 * Same check for a raw fetch Response status + body (e.g. a direct Gmail REST
 * call). 401 ⇒ reconnect; 403 only when the body shows a scope/permission issue.
 */
export function isGmailReconnectResponse(status: number, body: string): boolean {
  if (status === 401) return true
  if (status === 403) return RECONNECT_PATTERNS.test(body || "") || /scope|permission/i.test(body || "")
  return false
}

export function gmailReconnectResponse(email?: string | null) {
  return NextResponse.json(
    { error: GMAIL_RECONNECT_MESSAGE, reconnect: true, email: email ?? null },
    { status: 409 },
  )
}
