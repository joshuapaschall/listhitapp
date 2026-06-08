// components/sites/site-fonts.tsx
import { googleFontsHref } from "@/lib/site-builder/typography"

// Preconnect to the font origins (and the Supabase image origin) before the
// render-blocking stylesheet, then load it. Centralizes what used to be a bare
// <link rel="stylesheet"> duplicated across every public-site page wrapper.
function supabaseOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

export function SiteFonts({ typeStyleId }: { typeStyleId?: string }) {
  const sb = supabaseOrigin()
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {sb ? <link rel="preconnect" href={sb} /> : null}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={googleFontsHref(typeStyleId)} />
    </>
  )
}
