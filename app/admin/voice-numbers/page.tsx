"use client"

import { supabase } from "@/lib/supabase"
import { getUserRole } from "@/lib/get-user-role"
import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

type VoiceNumber = {
  id: string
  phone_number: string
  friendly_name: string | null
  provider_id: string | null
  connection_id: string | null
  messaging_profile_id: string | null
  tags: string[] | null
  status: string | null
  created_at: string
}

export default function VoiceNumbersPage() {
  const [numbers, setNumbers] = useState<VoiceNumber[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    const fetchNumbers = async () => {
      const r = await getUserRole(supabase)
      setRole(r)
      if (r === "admin") {
        const { data, error } = await supabase
          .from("voice_numbers")
          .select("*")
          .order("created_at", { ascending: false })

        if (error) {
          console.error("Error fetching voice numbers:", error)
        } else {
          setNumbers(data || [])
        }
      }
      setLoading(false)
    }

    fetchNumbers()
  }, [])

  if (loading) return <p>Loading...</p>
  if (role !== "admin") return <div className="p-4">Access denied</div>

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">📞 Voice Numbers</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {numbers.map((num) => (
          <Card key={num.id}>
            <CardHeader>
              <CardTitle>{num.phone_number}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {num.friendly_name && <p><strong>Name:</strong> {num.friendly_name}</p>}
              {num.provider_id && <p><strong>Provider ID:</strong> {num.provider_id}</p>}
              {num.status && <p><strong>Status:</strong> {num.status}</p>}
              {num.connection_id && <p><strong>Connection:</strong> {num.connection_id}</p>}
              {num.messaging_profile_id && <p><strong>Messaging:</strong> {num.messaging_profile_id}</p>}
              {num.tags && num.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {num.tags.map((tag) => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  ))}
                </div>
              )}
              <Separator className="my-2" />
              <p className="text-xs">Synced on {new Date(num.created_at).toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
