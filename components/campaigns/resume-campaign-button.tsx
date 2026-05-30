"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Play } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { supabaseBrowser } from "@/lib/supabase-browser"

export default function ResumeCampaignButton({ campaignId }: { campaignId: string }) {
  const router = useRouter()
  const [isResuming, setIsResuming] = useState(false)

  const resumeCampaign = async () => {
    const supabase = supabaseBrowser()
    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token
    if (!accessToken) {
      toast.error("Not logged in — please refresh and sign in again.")
      return
    }

    setIsResuming(true)
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/resume`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body?.error || "Resume failed")
      }

      toast.success(`Campaign resumed — ${body?.resumed ?? 0} queued emails restored.`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Resume failed")
    } finally {
      setIsResuming(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={resumeCampaign} disabled={isResuming}>
      <Play className="mr-2 h-4 w-4" />
      {isResuming ? "Resuming…" : "Resume"}
    </Button>
  )
}
