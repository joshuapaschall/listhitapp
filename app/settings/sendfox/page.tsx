"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"

interface StatusResponse {
  connected: boolean
  expires_at?: string | null
  updated_at?: string | null
}

export default function SendFoxSettingsPage() {
  const [status, setStatus] = useState<StatusResponse>({ connected: false })
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState(false)

  useEffect(() => {
    const loadStatus = async () => {
      setLoading(true)
      try {
        const res = await fetch("/api/sendfox/oauth/status")
        if (!res.ok) throw new Error("Failed to load status")
        const data = (await res.json()) as StatusResponse
        setStatus(data)
      } catch {
        setStatus({ connected: false })
      } finally {
        setLoading(false)
      }
    }
    loadStatus()
  }, [])

  const expiresText = useMemo(() => {
    if (!status.expires_at) return ""
    const date = new Date(status.expires_at)
    return date.toLocaleString()
  }, [status.expires_at])

  const handleDisconnect = async () => {
    setRevoking(true)
    try {
      await fetch("/api/sendfox/oauth/status", { method: "DELETE" })
      setStatus({ connected: false })
    } finally {
      setRevoking(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">SendFox account</h1>
        <p className="text-sm text-muted-foreground">
          Connect your SendFox account so every action runs against your personal access token instead of a shared environment
          key.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connection</CardTitle>
          <CardDescription>Authorize ListHit to read and send through your SendFox workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Badge variant={status.connected ? "default" : "secondary"}>
                {status.connected ? "Connected" : loading ? "Checking..." : "Not connected"}
              </Badge>
              {status.connected && (
                <span className="text-sm text-muted-foreground">
                  Token expires {expiresText || "soon"}
                  {status.updated_at ? ` • refreshed ${new Date(status.updated_at).toLocaleString()}` : ""}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant={status.connected ? "outline" : "default"}
                onClick={() => {
                  window.location.href = "/api/sendfox/oauth/start"
                }}
                disabled={loading}
              >
                {status.connected ? "Reconnect" : "Connect SendFox"}
              </Button>
              {status.connected && (
                <Button variant="ghost" onClick={handleDisconnect} disabled={revoking}>
                  {revoking ? "Disconnecting..." : "Disconnect"}
                </Button>
              )}
            </div>
          </div>
          <Separator />
          <Alert>
            <AlertTitle>Token rotation & revocation</AlertTitle>
            <AlertDescription>
              Access tokens are refreshed automatically using your stored refresh token. If refresh fails or you disconnect, ListHit
              marks the SendFox credential as revoked and falls back to environment keys only if configured.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
