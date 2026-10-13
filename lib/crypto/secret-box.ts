import "server-only"

import crypto from "crypto"

// AES-256-GCM envelope for secrets we must store and later use (per-org Twilio
// auth tokens and API key secrets). The key is LISTHIT_SECRETS_KEY: base64 that
// decodes to exactly 32 bytes. Read lazily so a deploy without it still builds.
//
// Format: v1:<iv b64>:<tag b64>:<ciphertext b64>, with a fresh 12-byte IV per call.

const VERSION = "v1"
const IV_BYTES = 12
const TAG_BYTES = 16

function getKey(): Buffer {
  const raw = process.env.LISTHIT_SECRETS_KEY
  if (!raw) throw new Error("LISTHIT_SECRETS_KEY is not set.")
  const key = Buffer.from(raw, "base64")
  if (key.length !== 32) {
    throw new Error("LISTHIT_SECRETS_KEY must be base64 that decodes to exactly 32 bytes.")
  }
  return key
}

export function encryptSecret(plain: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":")
}

export function decryptSecret(blob: string): string {
  const parts = typeof blob === "string" ? blob.split(":") : []
  if (parts.length !== 4) throw new Error("Malformed secret.")
  const [version, ivB64, tagB64, ctB64] = parts
  if (version !== VERSION) throw new Error(`Unknown secret version "${version}".`)

  const iv = Buffer.from(ivB64, "base64")
  const tag = Buffer.from(tagB64, "base64")
  const ciphertext = Buffer.from(ctB64, "base64")
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new Error("Malformed secret.")

  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv)
  decipher.setAuthTag(tag)
  // final() throws when the tag doesn't authenticate (tampered or wrong key).
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
}
