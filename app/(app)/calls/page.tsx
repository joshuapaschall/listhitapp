"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Mail, MessageSquare, Phone, RefreshCw } from "lucide-react";
import MainLayout from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Can } from "@/components/auth/Can";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import CallLogFilters, { CallLogFiltersValue } from "@/components/calls/call-log-filters";
import CallLogTable, { CallRow } from "@/components/calls/call-log-table";
import CallStatusBadge from "@/components/calls/call-status-badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { contactName, externalNumber, formatPhone, ownedNumber, ownedNumberLabel, relativeCallTime } from "@/lib/calls/format";
import { useCall } from "@/components/voice/CallProvider";
import SendSmsModal from "@/components/buyers/send-sms-modal";
import SendEmailModal from "@/components/buyers/send-email-modal";
import type { Buyer } from "@/lib/supabase";

// The send modals expect a full Buyer; build a minimal one from the call's partial
// buyer (the modals only read id/fname/lname/full_name/phone/email).
function callBuyerToBuyer(call: CallRow): Buyer | null {
  const b = call.buyer;
  if (!b?.id) return null;
  const full_name = `${b.fname ?? ""} ${b.lname ?? ""}`.trim();
  return { id: b.id, fname: b.fname ?? null, lname: b.lname ?? null, full_name, phone: b.phone ?? null, email: b.email ?? null } as Buyer;
}

function CallDetailContent({ call, onCallBack, onText, onEmail, recent }: { call: CallRow | null; onCallBack: (call: CallRow) => void; onText: (call: CallRow) => void; onEmail: (call: CallRow) => void; recent: CallRow[] }) {
  if (!call) return <p className="text-sm text-muted-foreground">Select a call to view detail.</p>;
  const did = ownedNumber(call);
  const isSaved = Boolean(call.buyer?.id);
  const hasEmail = Boolean(call.buyer?.email);
  return (
    <div className="space-y-4">
      <div>
        <p className="font-semibold">{contactName(call)}</p>
        <p className="text-sm text-muted-foreground">{formatPhone(externalNumber(call))}</p>
      </div>

      {did ? (
        <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <span>{ownedNumberLabel(call)}</span>
          <span className="font-mono text-foreground">{formatPhone(did)}</span>
        </div>
      ) : null}

      <Can permission="calls.make_receive">
        <Button variant="brand" className="w-full" onClick={() => onCallBack(call)}>Call back</Button>
      </Can>

      {isSaved ? (
        <>
          <div className={`grid gap-2 ${hasEmail ? "grid-cols-2" : "grid-cols-1"}`}>
            <Button variant="outline" className="gap-1.5" onClick={() => onText(call)}><MessageSquare className="h-4 w-4" />Text</Button>
            {hasEmail ? <Button variant="outline" className="gap-1.5" onClick={() => onEmail(call)}><Mail className="h-4 w-4" />Email</Button> : null}
          </div>
          <div className="text-center">
            <Link href={`/buyers?buyerId=${call.buyer!.id}`} className="inline-flex items-center gap-1 text-sm text-brand">View buyer <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </div>
        </>
      ) : (
        <>
          <Button variant="outline" className="w-full gap-1.5" onClick={() => onText(call)}><MessageSquare className="h-4 w-4" />Text back</Button>
          {did ? <p className="text-center text-xs text-muted-foreground">Replies send from {formatPhone(did)} — the number they dialed.</p> : null}
        </>
      )}

      {call.telnyx_recording_id || call.recording_url || call.voicemail_storage_path ? <Can permission="calls.recordings"><div className="rounded-lg border border-border bg-card p-3"><audio controls className="w-full" src={call.call_sid ? `/api/recordings/${call.call_sid}/stream` : call.recording_url ?? call.voicemail_storage_path ?? undefined} /></div></Can> : null}
      <div>
        <p className="mb-2 text-sm font-medium">Recent with this contact</p>
        <div className="space-y-2">
          {recent.map((c) => <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm"><span>{relativeCallTime(c.started_at)}</span><CallStatusBadge status={c.status} /></div>)}
          {recent.length === 0 ? <p className="text-sm text-muted-foreground">No recent calls in this view.</p> : null}
        </div>
      </div>
    </div>
  );
}

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
  const [detailOpen, setDetailOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { makeCall } = useCall();
  const { can, loading: permissionsLoading } = usePermissions();
  const canMakeReceiveCalls = can("calls.make_receive");

  const [showSms, setShowSms] = useState(false);
  const [smsBuyer, setSmsBuyer] = useState<Buyer | null>(null);
  const [smsInitialTo, setSmsInitialTo] = useState<string | null>(null);
  const [smsInitialFrom, setSmsInitialFrom] = useState<string | null>(null);
  const [showEmail, setShowEmail] = useState(false);
  const [emailBuyer, setEmailBuyer] = useState<Buyer | null>(null);

  useEffect(() => setPage(1), [filters]);

  const handleCallBack = (call: CallRow) => {
    makeCall(call.direction === "inbound" ? call.from_number ?? "" : call.to_number ?? "", call.buyer?.id ?? undefined);
  };

  const handleText = (call: CallRow) => {
    const buyer = callBuyerToBuyer(call);
    if (buyer) {
      setSmsBuyer(buyer); setSmsInitialTo(null); setSmsInitialFrom(null);
    } else {
      // Unknown caller: text them back from the exact DID they dialed.
      setSmsBuyer(null);
      setSmsInitialTo(externalNumber(call) || null);
      setSmsInitialFrom(ownedNumber(call) || null);
    }
    setShowSms(true);
  };

  const handleEmail = (call: CallRow) => {
    const buyer = callBuyerToBuyer(call);
    if (buyer && call.buyer?.email) { setEmailBuyer(buyer); setShowEmail(true); }
  };

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
      <div className="mx-auto max-w-[1600px] space-y-4 px-4 lg:px-8 py-8">
        <div className="flex items-start justify-between"><div><h1 className="text-3xl font-semibold tracking-tight">Calls</h1><p className="text-sm text-muted-foreground">Every call, recording, and voicemail.</p></div><Button variant="outline" onClick={() => { queryClient.invalidateQueries({ queryKey: ["calls-history"] }); queryClient.invalidateQueries({ queryKey: ["calls-stats"] }); }}><RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />Refresh</Button></div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Calls today</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-2xl font-semibold text-foreground">{statsData?.stats?.callsToday ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Talk time</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-2xl font-semibold text-foreground">{`${Math.floor((statsData?.stats?.talkTimeTodaySeconds ?? 0) / 60)}m`}</p>
            </CardContent>
          </Card>
          <button
            type="button"
            className="cursor-pointer text-left"
            onClick={() => setStatusFilter((current) => (current === "voicemail" ? "all" : "voicemail"))}
          >
            <Card className={`transition-colors hover:bg-muted/30 ${statusFilter === "voicemail" ? "ring-2 ring-brand bg-brand/5" : ""}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Voicemails</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-2xl font-semibold text-foreground">{statsData?.stats?.newVoicemails ?? 0}</p>
              </CardContent>
            </Card>
          </button>
          <button
            type="button"
            className="cursor-pointer text-left"
            onClick={() => setStatusFilter((current) => (current === "missed" ? "all" : "missed"))}
          >
            <Card className={`border-l-[3px] border-l-brand rounded-l-none transition-colors hover:bg-muted/30 ${statusFilter === "missed" ? "ring-2 ring-brand bg-brand/5" : ""}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Missed</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-2xl font-semibold text-foreground">{statsData?.stats?.missedToday ?? 0}</p>
              </CardContent>
            </Card>
          </button>
        </div>

        <CallLogFilters value={filters} onChange={setFilters} />

        <div className="grid gap-4 lg:grid-cols-[1.9fr_1fr]">
          <CallLogTable
            calls={filteredCalls}
            loading={isLoading}
            pagination={data?.pagination}
            setPage={setPage}
            selectedId={selectedCall?.id ?? null}
            onSelect={(call) => { setSelectedCall(call); if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) setDetailOpen(true); }}
          />
          <Card className="hidden lg:block h-fit">
            <CardHeader><CardTitle>Call detail</CardTitle></CardHeader>
            <CardContent>
              <CallDetailContent call={selectedCall} onCallBack={handleCallBack} onText={handleText} onEmail={handleEmail} recent={selectedRecent} />
            </CardContent>
          </Card>
        </div>
      </div>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="bottom" className="lg:hidden max-h-[85vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Call detail</SheetTitle></SheetHeader>
          <div className="mt-4"><CallDetailContent call={selectedCall} onCallBack={handleCallBack} onText={handleText} onEmail={handleEmail} recent={selectedRecent} /></div>
        </SheetContent>
      </Sheet>

      <SendSmsModal
        open={showSms}
        onOpenChange={setShowSms}
        buyer={smsBuyer}
        initialTo={smsInitialTo}
        initialFrom={smsInitialFrom}
      />
      <SendEmailModal
        open={showEmail}
        onOpenChange={setShowEmail}
        buyer={emailBuyer}
      />
    </MainLayout>
  );
}
