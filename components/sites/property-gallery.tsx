"use client"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { siteImage, siteSrcSet } from "@/lib/site-builder/image-url"
import { frameHeight } from "@/lib/site-builder/image-frame"

// Client gallery: a large primary image plus a clickable thumbnail strip.
// Theme-token framed; uses plain <img> (next.config has images.unoptimized).
// Selection lives in component state only — no browser storage APIs are used.
export function PropertyGallery({ images, alt }: { images: { image_url: string }[]; alt: string }) {
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const list = images || []
  const idx = list.length > 0 ? Math.min(active, list.length - 1) : 0

  const stripRef = useRef<HTMLDivElement>(null)
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([])
  const heroButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const firstRun = useRef(true)
  thumbRefs.current.length = list.length

  useEffect(() => setMounted(true), [])

  const goPrev = useCallback(
    () => setActive((i) => { const c = Math.min(i, list.length - 1); return (c - 1 + list.length) % list.length }),
    [list.length],
  )
  const goNext = useCallback(
    () => setActive((i) => { const c = Math.min(i, list.length - 1); return (c + 1) % list.length }),
    [list.length],
  )

  // Center the active thumbnail WITHIN the strip only — compute scrollLeft on the
  // strip directly rather than walking scrollable ancestors, which would scroll
  // the page vertically as a side effect on every arrow click.
  useEffect(() => {
    const strip = stripRef.current
    const thumb = thumbRefs.current[idx]
    if (!strip || !thumb) return
    const reduceMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const target = thumb.offsetLeft - (strip.clientWidth - thumb.clientWidth) / 2
    const max = strip.scrollWidth - strip.clientWidth
    const left = Math.max(0, Math.min(target, max)) // clamp — no iOS rubber-band overscroll
    strip.scrollTo({ left, behavior: reduceMotion || firstRun.current ? "auto" : "smooth" })
    firstRun.current = false
  }, [idx])

  // Lightbox: keyboard nav + focus trap, body scroll lock, focus save/restore.
  useEffect(() => {
    if (!open) return
    const heroButton = heroButtonRef.current
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        return
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        goPrev()
        return
      }
      if (e.key === "ArrowRight") {
        e.preventDefault()
        goNext()
        return
      }
      if (e.key === "Tab") {
        const dialog = dialogRef.current
        if (!dialog) return
        const focusables = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button"))
        if (focusables.length === 0) return
        const firstEl = focusables[0]
        const lastEl = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault()
          lastEl.focus()
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }
    document.addEventListener("keydown", onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeButtonRef.current?.focus()
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow // restore the SAVED value, not "" — don't clobber another lock
      heroButton?.focus()
    }
  }, [open, goPrev, goNext])

  const navBtnStyle = (side: "left" | "right", size: number): React.CSSProperties => ({
    position: "absolute",
    left: side === "left" ? 12 : undefined,
    right: side === "right" ? 12 : undefined,
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 1,
    width: size,
    height: size,
    borderRadius: 999,
    border: "none",
    padding: 0,
    cursor: "pointer",
    background: "rgba(255,255,255,.92)",
    boxShadow: "0 2px 10px rgba(5,12,24,.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  })

  if (list.length === 0) {
    return (
      <div
        style={{
          width: "100%",
          height: "clamp(460px, 56cqw, 720px)",
          borderRadius: 16,
          border: "1px solid #eef1f5",
          background: "color-mix(in srgb, var(--p) 5%, #fff)",
        }}
      />
    )
  }

  const current = list[idx]

  return (
    <div>
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "clamp(460px, 56cqw, 720px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Photo-hugging click target under the arrows (zIndex 0 < arrows' zIndex 1). */}
        <button
          ref={heroButtonRef}
          type="button"
          aria-label="View photo larger"
          onClick={() => setOpen(true)}
          style={{
            display: "flex",
            maxWidth: "100%",
            maxHeight: "100%",
            minWidth: 0,
            minHeight: 0,
            zIndex: 0,
            padding: 0,
            border: "none",
            background: "none",
            cursor: "zoom-in",
            lineHeight: 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={siteImage(current.image_url, { width: 1280, quality: 80 })}
            srcSet={siteSrcSet(current.image_url, [800, 1280, 1600], 80)}
            sizes="(max-width: 900px) 100vw, 760px"
            alt={alt}
            loading={active === 0 ? "eager" : "lazy"}
            fetchPriority={active === 0 ? "high" : "auto"}
            decoding="async"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              display: "block",
              borderRadius: 14,
            }}
          />
        </button>
        {list.length > 1 ? (
          <>
            <button type="button" aria-label="Previous photo" onClick={goPrev} style={navBtnStyle("left", 36)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <polyline points="10 4 6 8 10 12" stroke="#0b1220" strokeWidth={2} fill="none" />
              </svg>
            </button>
            <button type="button" aria-label="Next photo" onClick={goNext} style={navBtnStyle("right", 36)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <polyline points="6 4 10 8 6 12" stroke="#0b1220" strokeWidth={2} fill="none" />
              </svg>
            </button>
          </>
        ) : null}
      </div>

      {list.length > 1 ? (
        <div ref={stripRef} style={{ display: "flex", gap: 10, marginTop: 12, overflowX: "auto", paddingBottom: 4 }}>
          {list.map((img, i) => {
            const isActive = i === Math.min(active, list.length - 1)
            return (
              <button
                key={`${img.image_url}-${i}`}
                ref={(el) => {
                  thumbRefs.current[i] = el
                }}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`View photo ${i + 1}`}
                style={{
                  flex: "0 0 auto",
                  padding: 0,
                  border: isActive ? "2px solid var(--a)" : "2px solid #eef1f5",
                  borderRadius: 10,
                  overflow: "hidden",
                  cursor: "pointer",
                  background: "none",
                  lineHeight: 0,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={siteImage(img.image_url, { width: 96 })}
                  srcSet={siteSrcSet(img.image_url, [96, 192])}
                  sizes="96px"
                  alt={`${alt} — photo ${i + 1}`}
                  width={96}
                  height={frameHeight(96)}
                  loading="lazy"
                  decoding="async"
                  style={{ width: 96, height: frameHeight(96), objectFit: "cover", display: "block" }}
                />
              </button>
            )
          })}
        </div>
      ) : null}

      {mounted && open
        ? createPortal(
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label={alt}
              onClick={() => setOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 2147483000,
                background: "rgba(5,12,24,.92)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={siteImage(current.image_url, { width: 1920, quality: 82 })}
                srcSet={siteSrcSet(current.image_url, [1280, 1920, 2500], 82)}
                sizes="100vw"
                alt={alt}
                decoding="async"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "100vw", maxHeight: "100vh", objectFit: "contain", display: "block" }}
              />
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close"
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen(false)
                }}
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  background: "rgba(255,255,255,.92)",
                  boxShadow: "0 2px 10px rgba(5,12,24,.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <line x1="4" y1="4" x2="14" y2="14" stroke="#0b1220" strokeWidth={2} />
                  <line x1="14" y1="4" x2="4" y2="14" stroke="#0b1220" strokeWidth={2} />
                </svg>
              </button>
              {list.length > 1 ? (
                <>
                  <button
                    type="button"
                    aria-label="Previous photo"
                    onClick={(e) => {
                      e.stopPropagation()
                      goPrev()
                    }}
                    style={navBtnStyle("left", 44)}
                  >
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                      <polyline points="10 4 6 8 10 12" stroke="#0b1220" strokeWidth={2} fill="none" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Next photo"
                    onClick={(e) => {
                      e.stopPropagation()
                      goNext()
                    }}
                    style={navBtnStyle("right", 44)}
                  >
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                      <polyline points="6 4 10 8 6 12" stroke="#0b1220" strokeWidth={2} fill="none" />
                    </svg>
                  </button>
                  <div
                    style={{
                      position: "absolute",
                      bottom: 16,
                      left: "50%",
                      transform: "translateX(-50%)",
                      color: "rgba(255,255,255,.9)",
                      fontSize: 13,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {idx + 1} / {list.length}
                  </div>
                </>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
