"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getUserRole } from "@/lib/get-user-role"

export default function SyncNumbersPage() {
  const [response, setResponse] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    getUserRole(supabase).then((r) => setRole(r))
  }, [])

  if (role !== "admin") {
    if (role === null) return null
    return <div className="p-4">Access denied</div>
  }

  const handleSync = async () => {
    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      const res = await fetch("/api/internal/sync-numbers", {
        method: "POST",
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || "Failed to sync")
      }

      setResponse(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-4">Sync Telnyx Voice Numbers</h1>
      <button
        onClick={handleSync}
        disabled={loading}
        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded disabled:opacity-50"
      >
        {loading ? "Syncing..." : "Run Sync"}
      </button>

      {response && (
        <pre className="mt-6 text-sm bg-gray-900 p-4 rounded w-full max-w-2xl overflow-x-auto">
          {JSON.stringify(response, null, 2)}
        </pre>
      )}

      {error && (
        <p className="mt-4 text-red-500">Error: {error}</p>
      )}
    </div>
  )
}
