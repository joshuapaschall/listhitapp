import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

// Browsers POST CSP violation reports here (unauthenticated). We log a concise
// summary and always return 204 — never throw, never block.
const MAX_BYTES = 16_384

export async function POST(request: NextRequest) {
  try {
    const raw = (await request.text()).slice(0, MAX_BYTES)
    if (raw) {
      let parsed: any = null
      try {
        parsed = JSON.parse(raw)
      } catch {
        parsed = null
      }
      // Supports both the legacy `application/csp-report` shape ({ "csp-report": {...} })
      // and the Reporting API `application/reports+json` shape ([{ body: {...} }]).
      const report =
        parsed?.["csp-report"] ??
        (Array.isArray(parsed) ? parsed[0]?.body : null) ??
        parsed ??
        {}
      const violated = report["violated-directive"] ?? report.violatedDirective ?? report.effectiveDirective ?? "?"
      const blocked = report["blocked-uri"] ?? report.blockedURL ?? "?"
      const docUri = report["document-uri"] ?? report.documentURL ?? "?"
      console.warn(`[csp-report] violated=${violated} blocked=${blocked} document=${docUri}`)
    }
  } catch (err) {
    // Defensive: a malformed report must never surface as an error.
    console.warn("[csp-report] failed to process report", err)
  }
  return new NextResponse(null, { status: 204 })
}

export async function GET() {
  return new NextResponse("Method Not Allowed", { status: 405 })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
