"use client"

import { useEffect } from "react"

// Loads the Google Fonts stylesheet without blocking first paint. The server
// renders a high-priority <link rel="preload" as="style"> so the CSS downloads
// early; this injects the real stylesheet on mount, which hits the preload cache
// and applies almost instantly. Until then, text shows in the fallback font
// (the href carries display=swap). This removes the ~1.7s render-blocking
// stylesheet on mobile. No inline script, so it is unaffected by CSP tightening.
export function AsyncFontStylesheet({ href }: { href: string }) {
  useEffect(() => {
    if (!href) return
    if (document.querySelector('link[data-lh-font="1"]')) return
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = href
    link.setAttribute("data-lh-font", "1")
    document.head.appendChild(link)
  }, [href])
  return null
}
