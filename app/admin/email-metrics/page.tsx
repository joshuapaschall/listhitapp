"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getUserRole } from "@/lib/get-user-role"

export default function EmailMetricsPage() {
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    getUserRole(supabase).then((r) => setRole(r))
  }, [])

  if (role !== "admin") {
    if (role === null) return null
    return <div className="p-4">Access denied</div>
  }

  const runUpdate = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const userId =
        process.env.NODE_ENV === "development"
          ? "00000000-0000-0000-0000-000000000000"
          : undefined
      if (!userId) throw new Error("userId missing")
      console.warn("Using test userId; replace with real auth")
      const res = await fetch("/api/email-metrics/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to update")
      }
      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
      {process.env.NODE_ENV === "development" && (
        <div className="bg-yellow-500 text-black w-full text-center p-2 rounded mb-4">
          ⚠️ Using test userId — replace with real Supabase auth when ready.
        </div>
      )}
      <h1 className="text-3xl font-bold mb-4">Update Email Metrics</h1>
      <button
        onClick={runUpdate}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded disabled:opacity-50"
      >
        {loading ? "Updating..." : "Run Update"}
      </button>
      {result && (
        <pre className="mt-6 text-sm bg-gray-900 p-4 rounded w-full max-w-2xl overflow-x-auto">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
      {error && <p className="mt-4 text-red-500">Error: {error}</p>}
    </div>
  )
}
