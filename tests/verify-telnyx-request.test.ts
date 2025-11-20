import { describe, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"
import { generateKeyPairSync, sign } from "crypto"
import { Buffer } from "buffer"

jest.mock("@noble/ed25519", () => {
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

jest.mock("@noble/hashes/sha512", () => {
  const crypto = require("crypto")
  return {
    sha512: (msg: Uint8Array) => crypto.createHash("sha512").update(Buffer.from(msg)).digest(),
  }
})


import { verifyTelnyxRequest } from "../lib/telnyx"

describe("verifyTelnyxRequest", () => {
  test("returns true for valid signature", () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519")
    const pubRaw = publicKey.export({ format: "der", type: "spki" }).slice(-32)
    process.env.TELNYX_PUBLIC_KEY = pubRaw.toString("base64")
    const raw = "hi"
    const ts = "123"
    const msg = Buffer.from(`${ts}|${raw}`)
    const sig = sign(null, msg, privateKey).toString("base64")
    const req = new NextRequest("http://test", {
      method: "POST",
      headers: {
        "telnyx-signature-ed25519": sig,
        "telnyx-timestamp": ts,
      },
    })
    const result = verifyTelnyxRequest(req, raw)
    expect(result).toBe(true)
  })

  test("bypasses check when SKIP_TELNYX_SIG=1", () => {
    process.env.SKIP_TELNYX_SIG = "1"
    const req = new NextRequest("http://test", { method: "POST" })
    const result = verifyTelnyxRequest(req, "")
    expect(result).toBe(true)
    delete process.env.SKIP_TELNYX_SIG
  })
})
