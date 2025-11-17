import { MailX } from "lucide-react"
import KpiCard from "./KpiCard"

export default function EmailBouncesCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Email Bounces"
      value={value}
      icon={MailX}
      tooltip="Emails that bounced."
    />
  )
}
