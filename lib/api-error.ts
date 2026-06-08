import { NextResponse } from "next/server"

// Generic, client-safe error messages keyed by status. The full error is logged
// server-side; the client only ever sees one of these strings.
const GENERIC: Record<number, string> = {
  400: "Invalid request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not found",
  409: "Conflict",
  429: "Too many requests",
  500: "Something went wrong",
}

/**
 * Single entry point for client-facing API errors. Logs the full error
 * server-side and returns a generic message with the correct status — raw
 * exception/DB details never reach the client.
 *
 * `extra` lets a route preserve an existing response-body shape (e.g.
 * `{ ok: false }`) without leaking the message.
 */
export function apiError(
  err: unknown,
  status = 500,
  publicMessage?: string,
  extra?: Record<string, unknown>,
): NextResponse {
  console.error("[api-error]", { status }, err)
  return NextResponse.json(
    { ...(extra || {}), error: publicMessage ?? GENERIC[status] ?? "Something went wrong" },
    { status },
  )
}
