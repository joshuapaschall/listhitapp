import { NextRequest } from "next/server"
import { generateKeyPairSync, sign } from "crypto"
import { Buffer } from "buffer"

vi.mock("@noble/ed25519", () => {
  const crypto = require("crypto")
  return {
    etc: { concatBytes: (...arr) => Buffer.concat(arr) },
    verify: (sig: Uint8Array, msg: Uint8Array, pub: Uint8Array) => {
      const prefix = Buffer.from("302a300506032b6570032100", "hex")
      const key = crypto.createPublicKey({
        key: Buffer.concat([prefix, Buffer.from(pub)]),
        format: "der",
        type: "spki",
      })
      return crypto.verify(null, Buffer.from(msg), key, Buffer.from(sig))
    },
  }
})

vi.mock("@noble/hashes/sha512", () => {
  const crypto = require("crypto")
  return {
    sha512: (msg: Uint8Array) => crypto.createHash("sha512").update(Buffer.from(msg)).digest(),
  }
})


import { verifyTelnyxRequest } from "../lib/telnyx"

/** Signs `${ts}|${raw}` the way Telnyx does and sets TELNYX_PUBLIC_KEY to match. */
function signedRequest(raw: string, ts: string) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519")
  const pubRaw = publicKey.export({ format: "der", type: "spki" }).slice(-32)
  process.env.TELNYX_PUBLIC_KEY = pubRaw.toString("base64")
  const sig = sign(null, Buffer.from(`${ts}|${raw}`), privateKey).toString("base64")
  return new NextRequest("http://test", {
    method: "POST",
    headers: {
      "telnyx-signature-ed25519": sig,
      "telnyx-timestamp": ts,
    },
  })
}

const nowSeconds = () => Math.floor(Date.now() / 1000)

describe("verifyTelnyxRequest", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    delete process.env.SKIP_TELNYX_SIG
  })

  test("returns true for valid signature", () => {
    const raw = "hi"
    const req = signedRequest(raw, String(nowSeconds()))
    expect(verifyTelnyxRequest(req, raw)).toBe(true)
  })

  test("rejects a correctly signed request with a stale timestamp", () => {
    const raw = "hi"
    // 10 minutes old — outside the 300s replay window.
    const req = signedRequest(raw, String(nowSeconds() - 600))
    expect(verifyTelnyxRequest(req, raw)).toBe(false)
  })

  test("rejects a non-numeric timestamp", () => {
    const raw = "hi"
    const req = signedRequest(raw, "not-a-number")
    expect(verifyTelnyxRequest(req, raw)).toBe(false)
  })

  test("bypasses check when SKIP_TELNYX_SIG=1 outside production", () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("SKIP_TELNYX_SIG", "1")
    const req = new NextRequest("http://test", { method: "POST" })
    expect(verifyTelnyxRequest(req, "")).toBe(true)
  })

  test("ignores SKIP_TELNYX_SIG=1 in production", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("SKIP_TELNYX_SIG", "1")
    const req = new NextRequest("http://test", { method: "POST" })
    expect(verifyTelnyxRequest(req, "")).toBe(false)
  })
})
