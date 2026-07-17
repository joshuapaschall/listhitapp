"use client"
import React, { useState } from "react"
import { siteImage, siteSrcSet } from "@/lib/site-builder/image-url"
import {
  PHOTO_FRAME_RATIO,
  PHOTO_FRAME_W,
  PHOTO_FRAME_H,
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
          background: "color-mix(in srgb, var(--p) 5%, #fff)",
        }}
      />
    )
  }

  const idx = Math.min(active, list.length - 1)
  const current = list[idx]

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
        {list.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() =>
                setActive((i) => {
                  const c = Math.min(i, list.length - 1)
                  return (c - 1 + list.length) % list.length
                })
              }
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 1,
                width: 36,
                height: 36,
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
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <polyline points="10 4 6 8 10 12" stroke="#0b1220" strokeWidth={2} fill="none" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() =>
                setActive((i) => {
                  const c = Math.min(i, list.length - 1)
                  return (c + 1) % list.length
                })
              }
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 1,
                width: 36,
                height: 36,
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
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <polyline points="6 4 10 8 6 12" stroke="#0b1220" strokeWidth={2} fill="none" />
              </svg>
            </button>
          </>
        ) : null}
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
