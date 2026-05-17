import { createLogger } from "@/lib/logger"
import { SendFoxError, sendCampaign } from "@/services/sendfox-service"
import { withSendfoxAuth } from "@/services/sendfox-auth"
import { loadSendfoxRouteContext } from "../../../_auth"

export const dynamic = "force-dynamic"

const log = createLogger("sendfox-campaign-send-route")

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { authContext, response } = await loadSendfoxRouteContext()
    if (response) return response
    if (!authContext) {
      return Response.json({ connected: false })
    }

    const data = await withSendfoxAuth(authContext, async () => sendCampaign(Number(params.id)))
    return Response.json(data)
  } catch (err: any) {
    log("error", "Failed to send SendFox campaign", { error: err?.message })
    const status = err instanceof SendFoxError ? err.status : 500
    return Response.json({ error: err?.message || "Failed to send campaign" }, { status })
  }
}
