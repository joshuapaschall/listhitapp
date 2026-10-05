// Both copies of the CORS allowlist used to ship localhost to production, so any
// page on a developer's machine could call the public API against live data.

const OWNER = [
  "https://georgiawholesalehomes.com",
  "https://www.georgiawholesalehomes.com",
]
const DEV = ["http://localhost:3000", "http://localhost:3001"]

async function loadOrigins() {
  vi.resetModules()
  const mod = await import("@/lib/public-api/origins")
  return mod.ALLOWED_ORIGINS
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("ALLOWED_ORIGINS", () => {
  test("excludes localhost in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const origins = await loadOrigins()
    expect([...origins]).toEqual(OWNER)
    for (const dev of DEV) expect(origins).not.toContain(dev)
  })

  test("includes localhost outside production", async () => {
    vi.stubEnv("NODE_ENV", "development")
    const origins = await loadOrigins()
    for (const dev of DEV) expect(origins).toContain(dev)
    for (const owner of OWNER) expect(origins).toContain(owner)
  })

  test("includes localhost under test", async () => {
    vi.stubEnv("NODE_ENV", "test")
    expect(await loadOrigins()).toContain("http://localhost:3000")
  })

  test("the owner site origins are always allowed", async () => {
    for (const env of ["production", "development", "test"]) {
      vi.stubEnv("NODE_ENV", env)
      const origins = await loadOrigins()
      for (const owner of OWNER) expect(origins).toContain(owner)
    }
  })
})

describe("the two re-exports agree with origins.ts", () => {
  test("lib/public-api and lib/public-api/cors expose the same list", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.resetModules()
    const [{ ALLOWED_ORIGINS: fromRoot }, { ALLOWED_ORIGINS: fromCors }, { ALLOWED_ORIGINS: canonical }] =
      await Promise.all([
        import("@/lib/public-api"),
        import("@/lib/public-api/cors"),
        import("@/lib/public-api/origins"),
      ])
    expect(fromRoot).toBe(canonical)
    expect(fromCors).toBe(canonical)
  })
})
