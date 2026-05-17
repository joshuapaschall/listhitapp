import { createLogger } from "@/lib/logger"
import { SendFoxError, validateDomain } from "@/services/sendfox-service"
import { withSendfoxAuth } from "@/services/sendfox-auth"
import { loadSendfoxRouteContext } from "../../../_auth"

export const dynamic = "force-dynamic"

const log = createLogger("sendfox-domain-validate-route")

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { authContext, response } = await loadSendfoxRouteContext()
    if (response) return response
    if (!authContext) {
      return Response.json({ connected: false })
    }

    const domainId = Number(params.id)
    const data = await withSendfoxAuth(authContext, async () => validateDomain(domainId))
    return Response.json(data)
  } catch (err: any) {
    log("error", "Failed to validate SendFox domain", { error: err?.message })
    const status = err instanceof SendFoxError ? err.status : 500
    return Response.json({ error: err?.message || "Failed to validate domain" }, { status })
  }
}
