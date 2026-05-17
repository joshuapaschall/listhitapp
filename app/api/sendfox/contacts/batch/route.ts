import { createLogger } from "@/lib/logger"
import { SendFoxError, batchUpsertContacts } from "@/services/sendfox-service"
import { withSendfoxAuth } from "@/services/sendfox-auth"
import { loadSendfoxRouteContext } from "../../_auth"

export const dynamic = "force-dynamic"

const log = createLogger("sendfox-contacts-batch-route")

export async function POST(req: Request) {
  try {
    const { authContext, response } = await loadSendfoxRouteContext()
    if (response) return response
    if (!authContext) {
      return Response.json({ connected: false })
    }

    const body = await req.json()
    const data = await withSendfoxAuth(authContext, async () => batchUpsertContacts(body?.contacts || []))
    return Response.json(data)
  } catch (err: any) {
    log("error", "Failed to batch upsert SendFox contacts", { error: err?.message })
    const status = err instanceof SendFoxError ? err.status : 500
    return Response.json({ error: err?.message || "Failed to upsert contacts" }, { status })
  }
}
