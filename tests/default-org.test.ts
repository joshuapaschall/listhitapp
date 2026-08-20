import { describe, it, expect, afterEach } from "vitest"

import { resolveDefaultOrgId } from "@/lib/auth/default-org"

const ORIGINAL = process.env.DEFAULT_ORG_ID

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.DEFAULT_ORG_ID
  else process.env.DEFAULT_ORG_ID = ORIGINAL
})

describe("resolveDefaultOrgId", () => {
  it("returns the value when it is a UUID", () => {
    process.env.DEFAULT_ORG_ID = "adddfd02-790e-4be7-a0df-047b7dbdd1b8"
    expect(resolveDefaultOrgId()).toBe("adddfd02-790e-4be7-a0df-047b7dbdd1b8")
  })

  it("tolerates surrounding whitespace", () => {
    process.env.DEFAULT_ORG_ID = "  adddfd02-790e-4be7-a0df-047b7dbdd1b8  "
    expect(resolveDefaultOrgId()).toBe("adddfd02-790e-4be7-a0df-047b7dbdd1b8")
  })

  it("rejects a non-UUID value rather than passing it to a uuid column", () => {
    // The real regression: a Short.io API key pasted into DEFAULT_ORG_ID. Truthy,
    // so an unvalidated `?? process.env.DEFAULT_ORG_ID` sailed past every
    // "did we resolve an org?" guard and reached Postgres as 22P02.
    process.env.DEFAULT_ORG_ID = "KEY0197CC90F8E4142F96EDDA30BEC482B3"
    expect(resolveDefaultOrgId()).toBeNull()
  })

  it("returns null when unset or empty", () => {
    delete process.env.DEFAULT_ORG_ID
    expect(resolveDefaultOrgId()).toBeNull()

    process.env.DEFAULT_ORG_ID = ""
    expect(resolveDefaultOrgId()).toBeNull()
  })
})
