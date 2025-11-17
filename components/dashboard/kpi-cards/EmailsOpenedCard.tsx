import { MailOpen } from "lucide-react"
import KpiCard from "./KpiCard"

export default function EmailsOpenedCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Emails Opened"
      value={value}
      icon={MailOpen}
      tooltip="Emails opened by recipients."
    />
  )
}
