// Curated, professionally-paired color palettes for the Website Studio.
// Users can pick one of these or set exact custom colors. Client-safe.

export interface SitePalette {
  id: string
  label: string
  primary: string
  accent: string
}

export const PALETTES: SitePalette[] = [
  { id: "midnight", label: "Midnight & gold", primary: "#0f2a43", accent: "#f5a623" },
  { id: "forest", label: "Forest & brass", primary: "#16352a", accent: "#c9a227" },
  { id: "slate", label: "Slate & coral", primary: "#1f2937", accent: "#ff6251" },
  { id: "navy", label: "Navy & sky", primary: "#102a54", accent: "#3b82f6" },
  { id: "charcoal", label: "Charcoal & amber", primary: "#1c1917", accent: "#f59e0b" },
  { id: "oxblood", label: "Oxblood & cream", primary: "#5b1a1a", accent: "#d6a756" },
  { id: "teal", label: "Teal & orange", primary: "#0f3a3a", accent: "#ff8a3d" },
  { id: "royal", label: "Royal & gold", primary: "#1e2a78", accent: "#e8b923" },
]

export function getPalette(id: string | undefined): SitePalette | undefined {
  return PALETTES.find((p) => p.id === id)
}
