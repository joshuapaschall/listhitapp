"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Phone, RefreshCw } from "lucide-react";
import MainLayout from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Can } from "@/components/auth/Can";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import CallLogFilters, { CallLogFiltersValue } from "@/components/calls/call-log-filters";
import CallLogTable, { CallRow } from "@/components/calls/call-log-table";
import { contactName, externalNumber, formatPhone, relativeCallTime } from "@/lib/calls/format";
import { useCall } from "@/components/voice/CallProvider";

const APP_TIMEZONE = "America/New_York";

function zonedIso(range: "today" | "yesterday" | "this_week" | "this_month"): { dateFrom?: string; dateTo?: string } {
  const now = new Date();
  const zone = new Date(now.toLocaleString("en-US", { timeZone: APP_TIMEZONE }));
  const start = new Date(zone);
  if (range === "today") start.setHours(0, 0, 0, 0);
  if (range === "yesterday") start.setHours(0, 0, 0, 0), start.setDate(start.getDate() - 1);
  if (range === "this_week") start.setHours(0, 0, 0, 0), start.setDate(start.getDate() - start.getDay());
  if (range === "this_month") start.setHours(0, 0, 0, 0), start.setDate(1);
  const offsetMs = now.getTime() - zone.getTime();
  const dateFrom = new Date(start.getTime() + offsetMs).toISOString();
  if (range === "yesterday") {
    const endLocal = new Date(start);
    endLocal.setDate(endLocal.getDate() + 1);
    return { dateFrom, dateTo: new Date(endLocal.getTime() + offsetMs).toISOString() };
  }
  return { dateFrom };
}

export default function CallsPage() {
  const [filters, setFilters] = useState<CallLogFiltersValue>({ search: "", direction: "all", range: "today", customDateFrom: "", customDateTo: "" });
  const [statusFilter, setStatusFilter] = useState<"all" | "voicemail" | "missed">("all");
  const [page, setPage] = useState(1);
  const [selectedCall, setSelectedCall] = useState<CallRow | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { makeCall } = useCall();
  const { can, loading: permissionsLoading } = usePermissions();
  const canMakeReceiveCalls = can("calls.make_receive");

  useEffect(() => setPage(1), [filters]);

  const rangeParams = useMemo(() => {
    if (filters.range === "all") return {};
    if (filters.range === "custom") {
      let customDateFrom = filters.customDateFrom;
      let customDateTo = filters.customDateTo;

      if (customDateFrom && customDateTo && customDateFrom > customDateTo) {
        [customDateFrom, customDateTo] = [customDateTo, customDateFrom];
      }

      return {
        dateFrom: customDateFrom ? new Date(`${customDateFrom}T00:00:00`).toISOString() : undefined,
        dateTo: customDateTo ? new Date(`${customDateTo}T23:59:59`).toISOString() : undefined,
      };
    }
    return zonedIso(filters.range);
  }, [filters]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["calls-history", filters, statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "25", sortBy: "started_at", sortOrder: "desc" });
      if (rangeParams.dateFrom) params.set("dateFrom", rangeParams.dateFrom);
      if (rangeParams.dateTo) params.set("dateTo", rangeParams.dateTo);
      if (filters.search) params.set("search", filters.search);
      if (filters.direction !== "all") params.set("direction", filters.direction);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const response = await fetch(`/api/calls/history?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch calls");
      return response.json() as Promise<{ calls: CallRow[]; pagination: { page: number; totalPages: number; hasPrev: boolean; hasNext: boolean; total: number } }>;
    },
    enabled: canMakeReceiveCalls,
  });

  const { data: statsData } = useQuery({
    queryKey: ["calls-stats"],
    queryFn: async () => (await fetch("/api/calls/stats")).json() as Promise<{ stats: { callsToday: number; talkTimeTodaySeconds: number; missedToday: number; newVoicemails: number } }>,
    enabled: canMakeReceiveCalls,
  });

  const filteredCalls = useMemo(() => {
    const needle = filters.search.toLowerCase().trim();
    // TODO: Name search is only applied to currently loaded results until server-side buyer-name search is added.
    return (data?.calls ?? []).filter((call) => {
      const name = `${call.buyer?.fname ?? ""} ${call.buyer?.lname ?? ""}`.toLowerCase();
      const nameMatch = !needle || name.includes(needle);
      return nameMatch;
    });
  }, [data?.calls, filters.search]);

  useEffect(() => {
    if (error) toast({ title: "Error", description: "Could not load calls.", variant: "destructive" });
  }, [error, toast]);

  const selectedRecent = useMemo(() => {
    if (!selectedCall) return [];
    return filteredCalls.filter((c) => c.id !== selectedCall.id && (selectedCall.buyer_id ? c.buyer_id === selectedCall.buyer_id : externalNumber(c) === externalNumber(selectedCall))).slice(0, 4);
  }, [filteredCalls, selectedCall]);

  if (permissionsLoading) {
    return (
      <MainLayout>
        <div className="mx-auto flex min-h-[60vh] max-w-[1400px] items-center justify-center px-6 py-8">
          <p className="text-sm text-muted-foreground">Checking call permissions...</p>
        </div>
      </MainLayout>
    );
  }

  if (!canMakeReceiveCalls) {
    return (
      <MainLayout>
        <div className="mx-auto flex min-h-[60vh] max-w-[1400px] items-center justify-center px-6 py-8">
          <div className="max-w-md text-center">
            <Phone className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-semibold">You don&apos;t have access to Calls</h2>
            <p className="text-sm text-muted-foreground">
              Ask an administrator to grant calls.make_receive before you can use calling features.
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-[1400px] space-y-4 px-6 py-8">
        <div className="flex items-start justify-between"><div><h1 className="text-3xl font-semibold tracking-tight">Calls</h1><p className="text-sm text-muted-foreground">Every call, recording, and voicemail.</p></div><Button variant="outline" onClick={() => { queryClient.invalidateQueries({ queryKey: ["calls-history"] }); queryClient.invalidateQueries({ queryKey: ["calls-stats"] }); }}><RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />Refresh</Button></div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Calls today</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-2xl font-semibold text-emerald-700">{statsData?.stats?.callsToday ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Talk time</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-2xl font-semibold text-emerald-700">{`${Math.floor((statsData?.stats?.talkTimeTodaySeconds ?? 0) / 60)}m`}</p>
            </CardContent>
          </Card>
          <button
            type="button"
            className="cursor-pointer text-left"
            onClick={() => setStatusFilter((current) => (current === "voicemail" ? "all" : "voicemail"))}
          >
            <Card className={`transition-colors hover:bg-muted/30 ${statusFilter === "voicemail" ? "ring-2 ring-purple-500 bg-purple-50" : ""}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Voicemails</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-2xl font-semibold text-purple-700">{statsData?.stats?.newVoicemails ?? 0}</p>
              </CardContent>
            </Card>
          </button>
          <button
            type="button"
            className="cursor-pointer text-left"
            onClick={() => setStatusFilter((current) => (current === "missed" ? "all" : "missed"))}
          >
            <Card className={`transition-colors hover:bg-muted/30 ${statusFilter === "missed" ? "ring-2 ring-red-500 bg-red-50" : ""}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Missed</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-2xl font-semibold text-red-600">{statsData?.stats?.missedToday ?? 0}</p>
              </CardContent>
            </Card>
          </button>
        </div>

        <CallLogFilters value={filters} onChange={setFilters} />

        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <CallLogTable calls={filteredCalls} loading={isLoading} pagination={data?.pagination} setPage={setPage} selectedId={selectedCall?.id ?? null} onSelect={setSelectedCall} />
          <Card className="h-fit">
            <CardHeader><CardTitle>Call detail</CardTitle></CardHeader>
            <CardContent>
              {!selectedCall ? <p className="text-sm text-muted-foreground">Select a call to view detail.</p> : <div className="space-y-4">
                <div>
                  <p className="font-semibold">{contactName(selectedCall)}</p>
                  <p className="text-sm text-muted-foreground">{formatPhone(externalNumber(selectedCall))}</p>
                  {selectedCall.buyer?.id ? <Link href={`/buyers/${selectedCall.buyer.id}`} className="mt-1 inline-flex items-center gap-1 text-sm text-emerald-700">View buyer <ArrowUpRight className="h-3.5 w-3.5" /></Link> : null}
                </div>
                <Can permission="calls.make_receive">
                  <Button className="w-full bg-[#059669] hover:bg-[#047857]" onClick={() => makeCall(selectedCall.direction === "inbound" ? selectedCall.from_number ?? "" : selectedCall.to_number ?? "", selectedCall.buyer?.id ?? undefined)}>Call back</Button>
                </Can>
                {selectedCall.telnyx_recording_id || selectedCall.recording_url || selectedCall.voicemail_storage_path ? <Can permission="calls.recordings"><div className="rounded-lg border bg-card p-3"><audio controls className="w-full" src={selectedCall.call_sid ? `/api/recordings/${selectedCall.call_sid}/stream` : selectedCall.recording_url ?? selectedCall.voicemail_storage_path ?? undefined} /></div></Can> : null}
                <div>
                  <p className="mb-2 text-sm font-medium">Recent with this contact</p>
                  <div className="space-y-2">
                    {selectedRecent.map((call) => <div key={call.id} className="rounded-md border p-2 text-sm"><p>{relativeCallTime(call.started_at)}</p><p className="text-muted-foreground">{call.status}</p></div>)}
                    {selectedRecent.length === 0 ? <p className="text-sm text-muted-foreground">No recent calls in this view.</p> : null}
                  </div>
                </div>
              </div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
