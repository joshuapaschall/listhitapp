"use client"

import { useEffect } from "react"

export default function useHotkeys(
  combo: string,
  callback: (e: KeyboardEvent) => void,
  deps: React.DependencyList = [],
) {
  useEffect(() => {
    const keys = combo.toLowerCase().split("+")
    const handler = (e: KeyboardEvent) => {
      const match = keys.every((k) => {
        if (k === "mod") return navigator.platform.includes("Mac") ? e.metaKey : e.ctrlKey
        if (k === "ctrl") return e.ctrlKey
        if (k === "meta") return e.metaKey
        if (k === "shift") return e.shiftKey
        if (k === "alt") return e.altKey
        return e.key.toLowerCase() === k
      })
      if (match) {
        e.preventDefault()
        callback(e)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, deps)
}
