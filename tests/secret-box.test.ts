import crypto from "crypto"

import { decryptSecret, encryptSecret } from "@/lib/crypto/secret-box"

describe("secret-box (AES-256-GCM)", () => {
  const prev = process.env.LISTHIT_SECRETS_KEY

  beforeEach(() => {
    process.env.LISTHIT_SECRETS_KEY = crypto.randomBytes(32).toString("base64")
  })

  afterAll(() => {
    if (prev === undefined) delete process.env.LISTHIT_SECRETS_KEY
    else process.env.LISTHIT_SECRETS_KEY = prev
  })

  test("round-trips a secret", () => {
    const blob = encryptSecret("twilio-auth-token-123")
    expect(blob.startsWith("v1:")).toBe(true)
    expect(blob).not.toContain("twilio-auth-token-123")
    expect(decryptSecret(blob)).toBe("twilio-auth-token-123")
  })

  test("two encryptions of the same input differ (random IV)", () => {
    const a = encryptSecret("same")
    const b = encryptSecret("same")
    expect(a).not.toBe(b)
    expect(decryptSecret(a)).toBe("same")
    expect(decryptSecret(b)).toBe("same")
  })

  test("a tampered tag throws", () => {
    const [v, iv, tag, ct] = encryptSecret("secret").split(":")
    const tagBytes = Buffer.from(tag, "base64")
    tagBytes[0] ^= 0xff
    expect(() => decryptSecret([v, iv, tagBytes.toString("base64"), ct].join(":"))).toThrow()
  })

  test("tampered ciphertext throws", () => {
    const [v, iv, tag, ct] = encryptSecret("secret").split(":")
    const ctBytes = Buffer.from(ct, "base64")
    ctBytes[0] ^= 0xff
    expect(() => decryptSecret([v, iv, tag, ctBytes.toString("base64")].join(":"))).toThrow()
  })

  test("an unknown version or malformed blob throws", () => {
    const [, iv, tag, ct] = encryptSecret("secret").split(":")
    expect(() => decryptSecret(["v9", iv, tag, ct].join(":"))).toThrow(/version/i)
    expect(() => decryptSecret("not-a-blob")).toThrow()
  })

  test("a wrong-length key throws", () => {
    process.env.LISTHIT_SECRETS_KEY = crypto.randomBytes(16).toString("base64")
    expect(() => encryptSecret("x")).toThrow(/32 bytes/)
  })

  test("a missing key throws", () => {
    delete process.env.LISTHIT_SECRETS_KEY
    expect(() => encryptSecret("x")).toThrow(/LISTHIT_SECRETS_KEY/)
  })
})
