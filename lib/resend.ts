import { assertServer } from "@/utils/assert-server"

assertServer()

const apiKey = process.env.RESEND_API_KEY
if (!apiKey) {
  console.warn("Missing RESEND_API_KEY — email notifications disabled")
} else {
  console.log("Resend configured with API key ending in:", apiKey.slice(-6))
}

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "ListHit <notifications@listhit.io>"

export const resend = apiKey
  ? {
      emails: {
        send: async (params: {
          from: string
          to: string
          subject: string
          html: string
        }) => {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: params.from,
              to: [params.to],
              subject: params.subject,
              html: params.html,
            }),
          })

          if (!response.ok) {
            const text = await response.text()
            console.error("Resend API error response:", { status: response.status, body: text })
            throw new Error(`Resend API error (${response.status}): ${text}`)
          }

          return await response.json()
        },
      },
    }
  : null
