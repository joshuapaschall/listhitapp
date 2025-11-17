"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

import { supabaseBrowser } from "@/lib/supabase-browser"

export default function AgentLoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const client = supabaseBrowser()
      const { error: signInError } = await client.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) {
        setError(signInError.message || "Login failed")
        return
      }
      router.push("/agents/portal")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md rounded border p-6">
        <h1 className="text-xl font-semibold text-center mb-1">Agent Login</h1>
        <p className="text-center text-sm text-muted-foreground mb-4">
          Sign in to access the call center
        </p>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input
              className="w-full border rounded px-3 py-2"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              className="w-full border rounded px-3 py-2"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            disabled={loading}
            className="w-full h-10 rounded bg-blue-600 text-white disabled:opacity-60"
            type="submit"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  )
}
