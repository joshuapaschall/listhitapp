import { beforeEach, describe, expect, jest, test } from "@jest/globals"

const getUserMock = jest.fn()
const getSendfoxIntegrationMock = jest.fn()
const buildSendfoxContextFromIntegrationMock = jest.fn()
const getDefaultSendfoxContextMock = jest.fn()

jest.mock("next/headers", () => ({
  cookies: () => ({}),
}))

jest.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: () => ({
    auth: {
      getUser: getUserMock,
    },
  }),
}))

jest.mock("@/services/sendfox-auth", () => ({
  getSendfoxIntegration: getSendfoxIntegrationMock,
  buildSendfoxContextFromIntegration: buildSendfoxContextFromIntegrationMock,
  getDefaultSendfoxContext: getDefaultSendfoxContextMock,
}))

describe("loadSendfoxRouteContext auth fallback", () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  test("returns env auth context when integration is missing", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
    getSendfoxIntegrationMock.mockResolvedValue(null)
    getDefaultSendfoxContextMock.mockReturnValue({ accessToken: "env-token", source: "env" })

    const { loadSendfoxRouteContext } = require("../app/api/sendfox/_auth")
    const result = await loadSendfoxRouteContext()

    expect(result.response).toBeUndefined()
    expect(result.userId).toBe("user-1")
    expect(result.authContext).toEqual({ accessToken: "env-token", source: "env" })
  })

  test("returns not connected response when integration and env context are missing", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-2" } } })
    getSendfoxIntegrationMock.mockResolvedValue(null)
    getDefaultSendfoxContextMock.mockReturnValue(null)

    const { loadSendfoxRouteContext } = require("../app/api/sendfox/_auth")
    const result = await loadSendfoxRouteContext()

    expect(result.authContext).toBeNull()
    expect(result.response?.status).toBe(200)
    await expect(result.response?.json()).resolves.toEqual({
      connected: false,
      error: "SendFox account not connected",
    })
  })

  test("prefers user integration over env context", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-3" } } })
    getSendfoxIntegrationMock.mockResolvedValue({ id: "int-1", user_id: "user-3" })
    buildSendfoxContextFromIntegrationMock.mockReturnValue({ accessToken: "user-token", source: "user" })
    getDefaultSendfoxContextMock.mockReturnValue({ accessToken: "env-token", source: "env" })

    const { loadSendfoxRouteContext } = require("../app/api/sendfox/_auth")
    const result = await loadSendfoxRouteContext()

    expect(buildSendfoxContextFromIntegrationMock).toHaveBeenCalledWith({ id: "int-1", user_id: "user-3" })
    expect(result.authContext).toEqual({ accessToken: "user-token", source: "user" })
    expect(result.response).toBeUndefined()
  })
})
