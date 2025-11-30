import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { buildSendfoxContextFromIntegration, getSendfoxIntegration } from "@/services/sendfox-auth"

export interface SendfoxRouteContext {
  userId: string
  authContext: ReturnType<typeof buildSendfoxContextFromIntegration> | null
  response?: Response
}

export async function loadSendfoxRouteContext(): Promise<SendfoxRouteContext> {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      userId: "",
      authContext: null,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    }
  }

  const integration = await getSendfoxIntegration(user.id).catch(() => null)
  if (!integration) {
    return {
      userId: user.id,
      authContext: null,
      response: new Response(
        JSON.stringify({ connected: false, error: "SendFox account not connected" }),
        { status: 200 },
      ),
    }
  }

  return {
    userId: user.id,
    authContext: buildSendfoxContextFromIntegration(integration),
  }
}
