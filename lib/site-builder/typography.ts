// Curated type-style pairings for the Website Studio. Each pairing is a
// heading + body font chosen to convert (legible, trustworthy, fast-loading)
// while still looking premium. All are free Google Fonts. Client-safe.

export interface TypeStyle {
  id: string
  label: string                 // plain wizard label
  headingFont: string           // CSS font-family value
  bodyFont: string              // CSS font-family value
  // Google Fonts css2 family specs (family + weights) for <link> building
  google: { family: string; weights: number[] }[]
}

export const TYPE_STYLES: TypeStyle[] = [
  {
    id: "bold",
    label: "Bold & confident",
    headingFont: "'Montserrat', sans-serif",
    bodyFont: "'Source Sans 3', sans-serif",
    google: [
      { family: "Montserrat", weights: [700, 800, 900] },
      { family: "Source Sans 3", weights: [400, 600] },
    ],
  },
  {
    id: "punchy",
    label: "Punchy & local",
    headingFont: "'Anton', sans-serif",
    bodyFont: "'Hanken Grotesk', sans-serif",
    google: [
      { family: "Anton", weights: [400] },
      { family: "Hanken Grotesk", weights: [400, 600, 700] },
    ],
  },
  {
    id: "sharp",
    label: "Modern & sharp",
    headingFont: "'Space Grotesk', sans-serif",
    bodyFont: "'Manrope', sans-serif",
    google: [
      { family: "Space Grotesk", weights: [500, 700] },
      { family: "Manrope", weights: [400, 600, 700] },
    ],
  },
  {
    id: "editorial",
    label: "Editorial & trusted",
    headingFont: "'Fraunces', serif",
    bodyFont: "'Hanken Grotesk', sans-serif",
    google: [
      { family: "Fraunces", weights: [600, 700] },
      { family: "Hanken Grotesk", weights: [400, 600] },
    ],
  },
  {
    id: "friendly",
    label: "Friendly & clean",
    headingFont: "'Plus Jakarta Sans', sans-serif",
    bodyFont: "'Inter', sans-serif",
    google: [
      { family: "Plus Jakarta Sans", weights: [600, 700, 800] },
      { family: "Inter", weights: [400, 500, 600] },
    ],
  },
  {
    id: "classic",
    label: "Classic & strong",
    headingFont: "'Oswald', sans-serif",
    bodyFont: "'Source Sans 3', sans-serif",
    google: [
      { family: "Oswald", weights: [500, 600, 700] },
      { family: "Source Sans 3", weights: [400, 600] },
    ],
  },
]

export const DEFAULT_TYPE_STYLE_ID = "bold"

export function getTypeStyle(id: string | undefined): TypeStyle {
  return TYPE_STYLES.find((t) => t.id === id) || TYPE_STYLES[0]
}

// Resolve a type style id to the two CSS font-family values.
export function resolveTypeFonts(id: string | undefined): { headingFont: string; bodyFont: string } {
  const t = getTypeStyle(id)
  return { headingFont: t.headingFont, bodyFont: t.bodyFont }
}

// Build the Google Fonts css2 stylesheet href for a type style.
export function googleFontsHref(id: string | undefined): string {
  const t = getTypeStyle(id)
  const families = t.google
    .map((g) => `family=${encodeURIComponent(g.family).replace(/%20/g, "+")}:wght@${g.weights.join(";")}`)
    .join("&")
  return `https://fonts.googleapis.com/css2?${families}&display=swap`
}
