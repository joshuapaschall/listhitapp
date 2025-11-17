"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

export default function NewCampaignPage() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const type = params.get("type")
    router.replace(`/campaigns${type ? `?type=${type}` : ""}`)
  }, [params, router])

  return null
}
