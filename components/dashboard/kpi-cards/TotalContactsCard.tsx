import { Contact } from "lucide-react"
import KpiCard from "./KpiCard"

export default function TotalContactsCard({ value }: { value: number }) {
  return (
    <KpiCard
      title="Total Contacts"
      value={value}
      icon={Contact}
      tooltip="Total number of contacts in your database."
    />
  )
}
