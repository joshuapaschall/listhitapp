/**
 * One password rule, shared by the two set-password routes and the invite
 * dialog, so the client and the server can never disagree about what is valid.
 *
 * Deliberately simple: length only. Complexity requirements the UI does not
 * display produce round-trip failures users cannot act on.
 */

export const MIN_PASSWORD_LENGTH = 10

/** Returns a human-readable error message, or null when the password is valid. */
export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string") return "Password is required."
  if (password.trim().length === 0) return "Password can't be blank."
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  return null
}

const LOWER = "abcdefghijkmnopqrstuvwxyz"
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"
const DIGITS = "23456789"
const SYMBOLS = "!@#$%^&*-_+="
const ALL = LOWER + UPPER + DIGITS + SYMBOLS

const GENERATED_LENGTH = 16

/** Uniform random index in [0, max), rejection-sampled so the modulo is unbiased. */
function randomIndex(max: number): number {
  const limit = Math.floor(256 / max) * max
  const byte = new Uint8Array(1)
  for (;;) {
    globalThis.crypto.getRandomValues(byte)
    if (byte[0] < limit) return byte[0] % max
  }
}

function pick(alphabet: string): string {
  return alphabet[randomIndex(alphabet.length)]
}

/**
 * 16 characters with at least one lower, upper, digit, and symbol. Ambiguous
 * glyphs (0/O, 1/l/I) are excluded — these get read aloud and retyped by hand.
 */
export function generatePassword(): string {
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)]
  while (chars.length < GENERATED_LENGTH) chars.push(pick(ALL))

  // Fisher-Yates, so the guaranteed characters do not always land in the first
  // four positions.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }

  return chars.join("")
}
