"use client"
import React from "react"
import { useSiteForm } from "@/lib/site-builder/site-context"
import { WRAP } from "@/lib/site-builder/blocks/primitives"
import { buildAreaLinks, formatMarketLabel } from "@/lib/site-builder/location-pages"

function socialHref(v: string) {
  return v.startsWith("http") ? v : `https://${v}`
}

const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  facebook: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M14 9h3l.5-3H14V4.5c0-.9.3-1.5 1.6-1.5H18V.2C17.5.1 16.4 0 15.3 0 12.8 0 11 1.5 11 4.3V6H8v3h3v9h3V9z"/></svg>,
  instagram: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>,
  youtube: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M23 12s0-3.5-.4-5.2c-.2-.9-.9-1.6-1.8-1.8C19 4.5 12 4.5 12 4.5s-7 0-8.8.5c-.9.2-1.6.9-1.8 1.8C1 8.5 1 12 1 12s0 3.5.4 5.2c.2.9.9 1.6 1.8 1.8 1.8.5 8.8.5 8.8.5s7 0 8.8-.5c.9-.2 1.6-.9 1.8-1.8.4-1.7.4-5.2.4-5.2zM9.7 15.5v-7l6 3.5-6 3.5z"/></svg>,
  linkedin: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0 0-5zM3 9h4v12H3zM10 9h3.8v1.7h.1c.5-.9 1.8-1.9 3.6-1.9 3.9 0 4.6 2.5 4.6 5.8V21h-4v-5c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V21h-4z"/></svg>,
  tiktok: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M16 3c.3 2.1 1.5 3.6 3.5 3.8v2.4c-1.2 0-2.4-.4-3.5-1.1V15a5.5 5.5 0 1 1-5.5-5.5c.3 0 .6 0 .9.1v2.5a3 3 0 1 0 2.1 2.9V3H16z"/></svg>,
}

export function SiteFooter({ text }: { text?: string }) {
  const { brandName, persona, markets, business, legalPaths, legalDisplay } = useSiteForm()
  // One source of truth for the area label/href math (location-pages.ts). The
  // context's `markets` is the markets_json shape buildAreaLinks expects.
  const areaLinks = buildAreaLinks({ persona, markets_json: markets })
  const serving =
    markets.scope === "nationwide" || markets.markets.length === 0
      ? "Serving buyers nationwide"
      : `Serving ${markets.markets.slice(0, 6).map(formatMarketLabel).join(" · ")}`
  const socials = (Object.keys(SOCIAL_ICONS) as Array<keyof typeof business.social>)
    .map((k) => ({ k, v: (business.social as any)[k] as string | undefined }))
    .filter((s) => s.v && s.v.trim().length > 0)
  const year = new Date().getFullYear()
  // Treat the legacy template default as empty so the org's real brand is used
  // (older saved sites still carry the literal "© Your Company. All rights reserved.").
  const isPlaceholder = !text || !text.trim() || text.trim() === "© Your Company. All rights reserved."
  const copyright = isPlaceholder ? `© ${year} ${brandName}. All rights reserved.` : text
  const colHead: React.CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "#0f1b29", marginBottom: 12 }
  const link: React.CSSProperties = { color: "#5a6675", textDecoration: "none", fontSize: 14, display: "block", marginBottom: 8 }

  return (
    <footer style={{ borderTop: "1px solid #eef1f5", background: "#fff" }}>
      <div style={{ ...WRAP, padding: "48px 24px 28px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 32 }}>
          {/* Brand */}
          <div>
            <div style={{ fontFamily: "var(--head)", fontWeight: 800, fontSize: 20, color: "var(--p)" }}>{brandName}</div>
            <div style={{ fontSize: 13.5, color: "#5a6675", marginTop: 8 }}>{serving}</div>
            {socials.length > 0 && (
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                {socials.map((s) => (
                  <a key={s.k} href={socialHref(s.v as string)} target="_blank" rel="noreferrer"
                     aria-label={s.k}
                     style={{ width: 34, height: 34, borderRadius: 999, border: "1px solid #e4e8ee", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--p)" }}>
                    {SOCIAL_ICONS[s.k as string]}
                  </a>
                ))}
              </div>
            )}
          </div>
          {/* Explore */}
          <div>
            <div style={colHead}>Explore</div>
            {/* eslint-disable @next/next/no-html-link-for-pages */}
            <a href="/" style={link}>Home</a>
            <a href="/properties" style={link}>Deals</a>
            <a href="/contact" style={link}>Contact</a>
            {/* eslint-enable @next/next/no-html-link-for-pages */}
          </div>
          {/* Legal */}
          <div>
            <div style={colHead}>Legal</div>
            {/* eslint-disable @next/next/no-html-link-for-pages */}
            <a href={legalPaths.privacy} style={link}>Privacy Policy</a>
            <a href={legalPaths.terms} style={link}>Terms of Use</a>
            {/* eslint-enable @next/next/no-html-link-for-pages */}
          </div>
          {/* Locations — operator's specific markets (hidden on nationwide). */}
          {areaLinks.length > 0 && (
            <div>
              <div style={colHead}>Locations</div>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              {areaLinks.map((a) => (
                <a key={a.href} href={a.href} style={link}>{a.label}</a>
              ))}
            </div>
          )}
          {/* Contact */}
          {(business.phone || business.email) && (
            <div>
              <div style={colHead}>Get in touch</div>
              {business.phone && <a href={`tel:${business.phone}`} style={link}>{business.phone}</a>}
              {business.email && <a href={`mailto:${business.email}`} style={link}>{business.email}</a>}
            </div>
          )}
        </div>
        <div style={{ borderTop: "1px solid #f1f4f8", marginTop: 32, paddingTop: 20, fontSize: 13, color: "#5a6675", textAlign: "center" }}>
          {copyright}
          {legalDisplay && legalDisplay !== brandName && (
            <div style={{ fontSize: 12, color: "#a3acb8", marginTop: 4 }}>{legalDisplay}</div>
          )}
        </div>
      </div>
    </footer>
  )
}
