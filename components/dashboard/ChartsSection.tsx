import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import type {
  TrendWithDelta,
  TextTrend,
  CallTrend,
  EmailTrend,
  OfferTrend,
  ShowingTrend,
  UnsubscribeTrend,
} from "@/services/dashboard-service"

interface ChartsSectionProps {
  textTrends: TrendWithDelta<TextTrend>
  callTrends: TrendWithDelta<CallTrend>
  emailTrends: TrendWithDelta<EmailTrend>
  offerTrends: TrendWithDelta<OfferTrend>
  showingTrends: TrendWithDelta<ShowingTrend>
  unsubscribeTrends: TrendWithDelta<UnsubscribeTrend>
}

export default function ChartsSection({
  textTrends,
  callTrends,
  emailTrends,
  offerTrends,
  showingTrends,
  unsubscribeTrends,
}: ChartsSectionProps) {
  const Delta = ({ delta }: { delta: number }) => {
    const positive = delta >= 0
    const color = positive ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
    const sign = positive ? "+" : ""
    return (
      <Badge className={`ml-2 text-xs ${color}`}>{`${sign}${delta.toFixed(1)}%`}</Badge>
    )
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            Texts Sent vs. Received
            <Delta delta={textTrends.delta} />
          </CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={textTrends.data} margin={{ left: 8, right: 8, top: 16, bottom: 8 }}>
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Line type="monotone" dataKey="sent" name="Sent" stroke="hsl(var(--primary))" strokeWidth={2} />
              <Line type="monotone" dataKey="received" name="Received" stroke="hsl(var(--muted-foreground))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            Calls Made vs. Received
            <Delta delta={callTrends.delta} />
          </CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={callTrends.data} margin={{ left: 8, right: 8, top: 16, bottom: 8 }}>
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Line type="monotone" dataKey="made" name="Made" stroke="hsl(var(--primary))" strokeWidth={2} />
              <Line type="monotone" dataKey="received" name="Received" stroke="hsl(var(--muted-foreground))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            Emails Sent vs. Received
            <Delta delta={emailTrends.delta} />
          </CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={emailTrends.data} margin={{ left: 8, right: 8, top: 16, bottom: 8 }}>
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Line type="monotone" dataKey="sent" name="Sent" stroke="hsl(var(--primary))" strokeWidth={2} />
              <Line type="monotone" dataKey="received" name="Received" stroke="hsl(var(--muted-foreground))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            Offers Created vs. Accepted
            <Delta delta={offerTrends.delta} />
          </CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={offerTrends.data} margin={{ left: 8, right: 8, top: 16, bottom: 8 }}>
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Line type="monotone" dataKey="created" name="Created" stroke="hsl(var(--primary))" strokeWidth={2} />
              <Line type="monotone" dataKey="accepted" name="Accepted" stroke="hsl(var(--muted-foreground))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            Showings Scheduled vs. Offers Created
            <Delta delta={showingTrends.delta} />
          </CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={showingTrends.data} margin={{ left: 8, right: 8, top: 16, bottom: 8 }}>
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Line type="monotone" dataKey="scheduled" name="Scheduled" stroke="hsl(var(--primary))" strokeWidth={2} />
              <Line type="monotone" dataKey="created" name="Offers" stroke="hsl(var(--muted-foreground))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            Unsubscribe Rate
            <Delta delta={unsubscribeTrends.delta} />
          </CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={unsubscribeTrends.data} margin={{ left: 8, right: 8, top: 16, bottom: 8 }}>
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Line type="monotone" dataKey="rate" name="Rate" stroke="hsl(var(--primary))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
