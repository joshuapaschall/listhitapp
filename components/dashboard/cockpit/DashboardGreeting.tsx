import type { ReactNode } from "react"

interface DashboardGreetingProps {
  briefing: string
  children?: ReactNode
}

function getTimeOfDayGreeting() {
  const hour = new Date().getHours()

  if (hour < 12) {
    return "Good morning,"
  }

  if (hour < 18) {
    return "Good afternoon,"
  }

  return "Good evening,"
}

export default function DashboardGreeting({ briefing, children }: DashboardGreetingProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-xl font-semibold tracking-tight text-foreground">
          {getTimeOfDayGreeting()}
        </div>
        <div className="mt-0.5 text-sm text-muted-foreground">{briefing}</div>
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  )
}
