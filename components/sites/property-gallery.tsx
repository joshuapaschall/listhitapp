"use client"
import React, { useState } from "react"

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
          aspectRatio: "16 / 10",
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
          width: "100%",
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid #eef1f5",
          background: "color-mix(in srgb, var(--p) 5%, #fff)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.image_url}
          alt={alt}
          width={1200}
          height={750}
          loading="lazy"
          decoding="async"
          style={{ width: "100%", height: "auto", aspectRatio: "16 / 10", objectFit: "cover", display: "block" }}
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
                  src={img.image_url}
                  alt={`${alt} — photo ${i + 1}`}
                  width={96}
                  height={68}
                  loading="lazy"
                  decoding="async"
                  style={{ width: 96, height: 68, objectFit: "cover", display: "block" }}
                />
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
