import { assertCronAuth, requireCronAuth } from "../lib/cron-auth"

const originalCronSecret = process.env.CRON_SECRET
const originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

afterEach(() => {
  if (originalCronSecret === undefined) {
    delete process.env.CRON_SECRET
  } else {
    process.env.CRON_SECRET = originalCronSecret
  }

  if (originalServiceRole === undefined) {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  } else {
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRole
  }
})

describe("assertCronAuth", () => {
  test("throws server misconfigured when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key"

    const req = new Request("http://localhost/cron", {
      headers: { "x-cron-secret": "token" },
    })

    let thrown: Response | undefined
    try {
      assertCronAuth(req)
    } catch (error) {
      thrown = error as Response
    }

    expect(thrown).toBeDefined()
    expect(thrown).toBeInstanceOf(Response)
    expect(thrown?.status).toBe(500)
    if (!thrown) {
      throw new Error("Expected response to be thrown")
    }
    await expect(thrown.json()).resolves.toEqual({ error: "Server misconfigured" })
  })

  test("throws unauthorized when token is missing or invalid", async () => {
    process.env.CRON_SECRET = "expected-token"

    const req = new Request("http://localhost/cron", {
      headers: { authorization: "Bearer wrong-token" },
    })

    let thrown: Response | undefined
    try {
      assertCronAuth(req)
    } catch (error) {
      thrown = error as Response
    }

    expect(thrown).toBeDefined()
    expect(thrown).toBeInstanceOf(Response)
    expect(thrown?.status).toBe(401)
    if (!thrown) {
      throw new Error("Expected response to be thrown")
    }
    await expect(thrown.json()).resolves.toEqual({ error: "Unauthorized" })
  })

  test("throws unauthorized for a token of a different length (no timingSafeEqual throw)", () => {
    process.env.CRON_SECRET = "expected-token"

    const req = new Request("http://localhost/cron", {
      headers: { "x-cron-secret": "short" },
    })

    expect(() => assertCronAuth(req)).toThrowError(expect.any(Response))
  })

  test("rejects the service role key — only CRON_SECRET authenticates cron", async () => {
    process.env.CRON_SECRET = "expected-token"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key"

    const req = new Request("http://localhost/cron", {
      headers: { authorization: "Bearer service-role-key" },
    })

    let thrown: Response | undefined
    try {
      assertCronAuth(req)
    } catch (error) {
      thrown = error as Response
    }

    expect(thrown?.status).toBe(401)
  })

  test("returns token when authorized", () => {
    process.env.CRON_SECRET = "expected-token"

    const req = new Request("http://localhost/cron", {
      headers: { "x-cron-secret": "expected-token" },
    })

    expect(assertCronAuth(req)).toBe("expected-token")
  })
})

describe("requireCronAuth", () => {
  test("returns null when the CRON_SECRET matches", () => {
    process.env.CRON_SECRET = "expected-token"

    const req = new Request("http://localhost/cron", {
      headers: { authorization: "Bearer expected-token" },
    })

    expect(requireCronAuth(req)).toBeNull()
  })

  test("401s on the service role key", () => {
    process.env.CRON_SECRET = "expected-token"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key"

    const req = new Request("http://localhost/cron", {
      headers: { authorization: "Bearer service-role-key" },
    })

    expect(requireCronAuth(req)?.status).toBe(401)
  })

  test("401s when CRON_SECRET is unset", () => {
    delete process.env.CRON_SECRET

    const req = new Request("http://localhost/cron", {
      headers: { "x-cron-secret": "anything" },
    })

    expect(requireCronAuth(req)?.status).toBe(401)
  })
})
