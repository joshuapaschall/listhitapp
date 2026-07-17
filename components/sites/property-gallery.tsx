"use client"
import React, { useState } from "react"
import { siteImage, siteSrcSet } from "@/lib/site-builder/image-url"
import {
  PHOTO_FRAME_RATIO,
  PHOTO_FRAME_W,
  PHOTO_FRAME_H,
  HERO_BACKDROP_WIDTH,
  HERO_BACKDROP_QUALITY,
  frameHeight,
} from "@/lib/site-builder/image-frame"

// Client gallery: a large primary image plus a clickable thumbnail strip.
// Theme-token framed; uses plain <img> (next.config has images.unoptimized).
// Selection lives in component state only — no browser storage APIs are used.
export function PropertyGallery({ images, alt }: { images: { image_url: string }[]; alt: string }) {
  const [active, setActive] = useState(0)
  const list = images || []

  if (list.length === 0) {
    return (
      <div
        style={{
          width: "100%",
          aspectRatio: PHOTO_FRAME_RATIO,
          borderRadius: 16,
          border: "1px solid #eef1f5",
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--p) 22%, #fff), color-mix(in srgb, var(--a) 22%, #fff))",
        }}
      />
    )
  }

  const current = list[Math.min(active, list.length - 1)]

  return (
    <div>
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: PHOTO_FRAME_RATIO,
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid #eef1f5",
          background: "color-mix(in srgb, var(--p) 5%, #fff)",
        }}
      >
        {/* Blurred backdrop: the same photo at a deliberately tiny size (~2KB) —
            detail is imperceptible through a 28px blur. Fills the letterbox for
            off-ratio photos so nothing is ever cropped. scale(1.15) hides the
            blur's transparent edge bleed. Decorative only. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={siteImage(current.image_url, { width: HERO_BACKDROP_WIDTH, quality: HERO_BACKDROP_QUALITY })}
          alt=""
          aria-hidden="true"
          loading={active === 0 ? "eager" : "lazy"}
          decoding="async"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "blur(28px) saturate(1.25)",
            transform: "scale(1.15)",
            display: "block",
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={siteImage(current.image_url, { width: 1280, quality: 80 })}
          srcSet={siteSrcSet(current.image_url, [800, 1280, 1600], 80)}
          sizes="(max-width: 900px) 100vw, 760px"
          alt={alt}
          width={PHOTO_FRAME_W * 300}
          height={PHOTO_FRAME_H * 300}
          loading={active === 0 ? "eager" : "lazy"}
          fetchPriority={active === 0 ? "high" : "auto"}
          decoding="async"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
          }}
        />
      </div>

      {list.length > 1 ? (
        <div style={{ display: "flex", gap: 10, marginTop: 12, overflowX: "auto", paddingBottom: 4 }}>
          {list.map((img, i) => {
            const isActive = i === Math.min(active, list.length - 1)
            return (
              <button
                key={`${img.image_url}-${i}`}
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
    </div>
  )
}
