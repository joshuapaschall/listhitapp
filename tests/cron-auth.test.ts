import { afterEach, describe, expect, test } from "@jest/globals"
import { assertCronAuth } from "../lib/cron-auth"

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
  test("throws server misconfigured when no allowed tokens are set", async () => {
    delete process.env.CRON_SECRET
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

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

  test("returns token when authorized", () => {
    process.env.CRON_SECRET = "expected-token"

    const req = new Request("http://localhost/cron", {
      headers: { "x-cron-secret": "expected-token" },
    })

    expect(assertCronAuth(req)).toBe("expected-token")
  })
})
