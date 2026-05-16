import { Resend } from "resend"
import { assertServer } from "@/utils/assert-server"

assertServer()

const apiKey = process.env.RESEND_API_KEY
if (!apiKey) console.warn("Missing RESEND_API_KEY — email notifications disabled")

export const resend = apiKey ? new Resend(apiKey) : null

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "ListHit <notifications@listhit.io>"
