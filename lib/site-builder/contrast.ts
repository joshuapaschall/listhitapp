// Client-safe. Given a hex color, returns the text color (#fff or near-black)
// that meets contrast against it. Used to pick legible text on accent/primary
// backgrounds regardless of the palette the user picks.
const DARK_INK = "#0f1b29"
const LIGHT_INK = "#ffffff"

export function readableTextOn(hex: string | undefined | null): string {
  const h = (hex || "").trim().replace(/^#/, "")
  const full =
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h
  if (full.length !== 6 || /[^0-9a-fA-F]/.test(full)) return LIGHT_INK
  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  // Contrast vs white vs vs dark ink; pick whichever is higher.
  const contrastWhite = 1.05 / (L + 0.05)
  const contrastDark = (L + 0.05) / 0.06
  return contrastDark >= contrastWhite ? DARK_INK : LIGHT_INK
}

// --- Accent text legibility on light backgrounds -----------------------------
// Returns the accent deepened (hue preserved, by scaling RGB toward black) just
// enough to read as small text on white at WCAG AA (4.5:1). If the accent already
// passes, it is returned unchanged. Falls back to DARK_INK only for unparseable
// input. Powers the --a-ink-light token (eyebrows, section labels, inline links).
const AA_NORMAL = 4.5

function parseHexRgb(hex: string | undefined | null): [number, number, number] | null {
  const h = (hex || "").trim().replace(/^#/, "")
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h
  if (full.length !== 6 || /[^0-9a-fA-F]/.test(full)) return null
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)]
}

function luminance255(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrastWithWhite(r: number, g: number, b: number): number {
  return 1.05 / (luminance255(r, g, b) + 0.05)
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`
}

export function readableAccentText(hex: string | undefined | null): string {
  const rgb = parseHexRgb(hex)
  if (!rgb) return DARK_INK
  const [r, g, b] = rgb
  if (contrastWithWhite(r, g, b) >= AA_NORMAL) return toHex(r, g, b)
  for (let k = 0.98; k > 0; k -= 0.02) {
    if (contrastWithWhite(r * k, g * k, b * k) >= AA_NORMAL) return toHex(r * k, g * k, b * k)
  }
  return DARK_INK
}
