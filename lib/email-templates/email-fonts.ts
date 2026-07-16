import type { CustomFont } from "@templatical/types"

export const EMAIL_DEFAULT_FONT = "Inter"
export const EMAIL_DEFAULT_FALLBACK = "Helvetica, Arial, sans-serif"

export const EMAIL_CUSTOM_FONTS: CustomFont[] = [
  { name: "Inter", url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap", fallback: "Helvetica, Arial, sans-serif" },
  { name: "Playfair Display", url: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&display=swap", fallback: "Georgia, serif" },
]
