// components/sites/site-fonts.tsx
import { googleFontsHref } from "@/lib/site-builder/typography"
import { AsyncFontStylesheet } from "@/components/sites/async-font-stylesheet"

// Preconnect to the font origins (and the Supabase image origin), then load the
// font CSS non-render-blocking: preload the stylesheet (high priority) and attach
// it on mount (AsyncFontStylesheet), with a <noscript> plain stylesheet for JS-off.
// Centralizes what used to be a bare <link rel="stylesheet"> duplicated across
// every public-site page wrapper.
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
  const href = googleFontsHref(typeStyleId)
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {sb ? <link rel="preconnect" href={sb} /> : null}
      {/* Non-blocking font load: preload the CSS, attach the stylesheet on mount. */}
      <link rel="preload" as="style" href={href} />
      <AsyncFontStylesheet href={href} />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={href} />
      </noscript>
    </>
  )
}
