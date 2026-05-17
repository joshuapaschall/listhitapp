import { createLogger } from "@/lib/logger"
import { SendFoxError, createCampaign, listCampaigns } from "@/services/sendfox-service"
import { withSendfoxAuth } from "@/services/sendfox-auth"
import { loadSendfoxRouteContext } from "../_auth"

export const dynamic = "force-dynamic"

const log = createLogger("sendfox-campaigns-route")

export async function GET() {
  try {
    const { authContext, response } = await loadSendfoxRouteContext()
    if (response) return response
    if (!authContext) {
      return Response.json({ connected: false })
    }

    const data = await withSendfoxAuth(authContext, async () => listCampaigns())
    return Response.json(data)
  } catch (err: any) {
    log("error", "Failed to list SendFox campaigns", { error: err?.message })
    const status = err instanceof SendFoxError ? err.status : 500
    return Response.json({ error: err?.message || "Failed to list campaigns" }, { status })
  }
}

export async function POST(req: Request) {
  try {
    const { authContext, response } = await loadSendfoxRouteContext()
    if (response) return response
    if (!authContext) {
      return Response.json({ connected: false })
    }

    const body = await req.json()
    const data = await withSendfoxAuth(authContext, async () => createCampaign(body))
    return Response.json(data)
  } catch (err: any) {
    log("error", "Failed to create SendFox campaign", { error: err?.message })
    const status = err instanceof SendFoxError ? err.status : 500
    return Response.json({ error: err?.message || "Failed to create campaign" }, { status })
  }
}
