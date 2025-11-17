import { Mail } from "lucide-react"
import KpiCard from "./KpiCard"

export default function EmailsReceivedCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Emails Received"
      value={value}
      icon={Mail}
      iconClass="text-blue-600"
      tooltip="Emails received from contacts."
    />
  )
}
