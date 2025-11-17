"use client"

import { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import { cn } from "@/lib/utils"
import "mapbox-gl/dist/mapbox-gl.css"

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN
}

interface MapPreviewProps {
  latitude: number | null
  longitude: number | null
  className?: string
}

export default function MapPreview({ latitude, longitude, className }: MapPreviewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!mapRef.current) return
    if (!mapboxgl.accessToken) {
      setError("Mapbox token missing")
      return
    }
    if (latitude == null || longitude == null) {
      setError("Address not resolved")
      return
    }
    setError(null)
    const map = new mapboxgl.Map({
      container: mapRef.current,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [longitude, latitude],
      zoom: 12,
    })
    new mapboxgl.Marker().setLngLat([longitude, latitude]).addTo(map)
    return () => map.remove()
  }, [latitude, longitude])

  return (
    <div ref={mapRef} className={cn("h-48 w-full rounded border", className)}>
      {error && (
        <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
          {error}
        </div>
      )}
    </div>
  )
}
