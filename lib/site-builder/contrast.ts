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
