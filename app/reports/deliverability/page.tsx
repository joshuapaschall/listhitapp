"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import MainLayout from "@/components/layout/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, Link as LinkIcon } from "lucide-react"

const WINDOW_LABELS = {
  "24h": "Last 24h",
  "7d": "Last 7d",
  "30d": "Last 30d",
} as const

type WindowParam = keyof typeof WINDOW_LABELS

type DeliverabilityResponse = {
  window: WindowParam
  kpis: {
    sent: number
    delivered: number
    opens: number
    clicks: number
    bounces: number
    complaints: number
    unsubscribes: number
    errors: number
  }
  rates: {
    bounceRate: number
    complaintRate: number
    unsubRate: number
    deliveryRate: number
    openRate: number
    ctr: number
  }
  recipients: Array<{
    email: string | null
    name: string | null
    last_status: string | null
    last_event_at: string | null
    error_message: string | null
    campaign_name: string | null
  }>
  topLinks: Array<{
    url: string | null
    totalClicks: number
    uniqueClickers: number
  }>
  linkClickers: Array<{
    url: string | null
    email: string | null
    name: string | null
    clicked_at: string | null
    campaign_name: string | null
  }>
}

const fetchDeliverability = async (window: WindowParam) => {
  const res = await fetch(`/api/reports/deliverability?window=${window}`)
  if (!res.ok) {
    throw new Error("Failed to load deliverability")
  }
  return (await res.json()) as DeliverabilityResponse
}

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value)

const formatRate = (value: number) => `${value.toFixed(2)}%`

const sanitize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

const statusVariant = (status: string) => {
  if (["bounce", "complaint", "error", "rejected", "failed"].includes(status)) {
    return "destructive" as const
  }
  if (["unsubscribe"].includes(status)) {
    return "secondary" as const
  }
  if (["open", "click", "delivery", "delivered"].includes(status)) {
    return "default" as const
  }
  return "outline" as const
}

const exportCsv = (rows: Record<string, unknown>[], headers: Array<{ key: string; label: string }>, filename: string) => {
  const headerRow = headers.map((header) => `"${header.label.replace(/"/g, "\"\"")}"`).join(",")
  const bodyRows = rows.map((row) =>
    headers
      .map((header) => {
        const raw = row[header.key]
        const value = raw === null || raw === undefined ? "" : String(raw)
        return `"${value.replace(/"/g, "\"\"")}"`
      })
      .join(",")
  )
  const csv = [headerRow, ...bodyRows].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function DeliverabilityPage() {
  const [window, setWindow] = useState<WindowParam>("7d")

  const { data, isLoading, error } = useQuery({
    queryKey: ["deliverability-report", window],
    queryFn: () => fetchDeliverability(window),
  })

  const kpiCards = useMemo(() => {
    if (!data) return []
    return [
      { label: "Sent", value: data.kpis.sent },
      { label: "Delivered", value: data.kpis.delivered },
      { label: "Opens", value: data.kpis.opens },
      { label: "Clicks", value: data.kpis.clicks },
      { label: "Bounces", value: data.kpis.bounces },
      { label: "Complaints", value: data.kpis.complaints },
      { label: "Unsubscribes", value: data.kpis.unsubscribes },
      { label: "Errors", value: data.kpis.errors },
    ]
  }, [data])

  const rateCards = useMemo(() => {
    if (!data) return []
    return [
      { label: "Delivery %", value: formatRate(data.rates.deliveryRate) },
      { label: "Open %", value: formatRate(data.rates.openRate) },
      { label: "CTR %", value: formatRate(data.rates.ctr) },
      { label: "Bounce %", value: formatRate(data.rates.bounceRate) },
      { label: "Complaint %", value: formatRate(data.rates.complaintRate) },
      { label: "Unsub %", value: formatRate(data.rates.unsubRate) },
    ]
  }, [data])

  const recipients = data?.recipients ?? []
  const topLinks = data?.topLinks ?? []
  const linkClickers = data?.linkClickers ?? []

  const handleExportRecipients = () => {
    exportCsv(
      recipients.map((row) => ({
        email: row.email || "",
        name: row.name || "",
        lastStatus: row.last_status || "",
        lastEvent: row.last_event_at || "",
        errorMessage: row.error_message || "",
        campaign: row.campaign_name || "",
      })),
      [
        { key: "email", label: "Email" },
        { key: "name", label: "Name" },
        { key: "lastStatus", label: "Last Status" },
        { key: "lastEvent", label: "Last Event Time" },
        { key: "errorMessage", label: "Error Message" },
        { key: "campaign", label: "Campaign" },
      ],
      `deliverability-recipients-${window}.csv`
    )
  }

  const handleExportLinkClickers = (url?: string | null) => {
    const rows = url ? linkClickers.filter((row) => row.url === url) : linkClickers
    exportCsv(
      rows.map((row) => ({
        url: row.url || "",
        email: row.email || "",
        name: row.name || "",
        clickedAt: row.clicked_at || "",
        campaign: row.campaign_name || "",
      })),
      [
        { key: "url", label: "URL" },
        { key: "email", label: "Email" },
        { key: "name", label: "Name" },
        { key: "clickedAt", label: "Clicked At" },
        { key: "campaign", label: "Campaign" },
      ],
      `deliverability-link-clickers-${sanitize(url || "all")}-${window}.csv`
    )
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Deliverability Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Monitor email health, engagement, and deliverability signals across campaigns.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(Object.keys(WINDOW_LABELS) as WindowParam[]).map((option) => (
              <Button
                key={option}
                variant={option === window ? "default" : "outline"}
                onClick={() => setWindow(option)}
              >
                {WINDOW_LABELS[option]}
              </Button>
            ))}
          </div>
        </div>

        {error && (
          <Card>
            <CardContent className="p-6 text-sm text-destructive">
              Failed to load deliverability data.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Delivery KPIs</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <div className="text-sm text-muted-foreground">Loading KPIs...</div>}
            {!isLoading && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {kpiCards.map((card) => (
                  <div key={card.label} className="rounded-lg border bg-muted/30 p-4">
                    <div className="text-sm text-muted-foreground">{card.label}</div>
                    <div className="text-2xl font-semibold">{formatNumber(card.value)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rates</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <div className="text-sm text-muted-foreground">Loading rates...</div>}
            {!isLoading && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rateCards.map((card) => (
                  <div key={card.label} className="rounded-lg border bg-muted/30 p-4">
                    <div className="text-sm text-muted-foreground">{card.label}</div>
                    <div className="text-2xl font-semibold">{card.value}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Recipient Drilldown</CardTitle>
              <p className="text-sm text-muted-foreground">
                Latest recipient status and errors for the selected time window.
              </p>
            </div>
            <Button variant="outline" onClick={handleExportRecipients} disabled={!recipients.length}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Event</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                      Loading recipients...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && recipients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                      No recipient activity found in this window.
                    </TableCell>
                  </TableRow>
                )}
                {recipients.map((row, index) => {
                  const status = (row.last_status || "unknown").toLowerCase()
                  return (
                    <TableRow key={`${row.email}-${index}`}>
                      <TableCell className="font-medium">{row.email || "-"}</TableCell>
                      <TableCell>{row.name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(status)}>{status}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {row.last_event_at ? new Date(row.last_event_at).toLocaleString() : "-"}
                      </TableCell>
                      <TableCell>{row.campaign_name || "-"}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {row.error_message || "-"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Top Links</CardTitle>
              <p className="text-sm text-muted-foreground">
                Most clicked links across all campaigns in this window.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => handleExportLinkClickers()}
              disabled={!linkClickers.length}
            >
              <Download className="mr-2 h-4 w-4" />
              Export Clickers
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Total Clicks</TableHead>
                  <TableHead>Unique Clickers</TableHead>
                  <TableHead className="text-right">Export</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      Loading top links...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && topLinks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      No link clicks recorded.
                    </TableCell>
                  </TableRow>
                )}
                {topLinks.map((row, index) => (
                  <TableRow key={`${row.url || "unknown"}-${index}`}>
                    <TableCell className="max-w-sm">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{row.url || "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatNumber(row.totalClicks)}</TableCell>
                    <TableCell>{formatNumber(row.uniqueClickers)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExportLinkClickers(row.url)}
                        disabled={!row.url}
                      >
                        Export
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
