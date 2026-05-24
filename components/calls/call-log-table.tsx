"use client";

import { Phone, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { contactName, externalNumber, formatDuration, formatPhone, handledBy, relativeCallTime, CallLike } from "@/lib/calls/format";
import CallStatusBadge from "@/components/calls/call-status-badge";
import RecordingPlayer from "@/components/calls/recording-player";

export interface CallRow extends CallLike {
  id: string;
  status?: string | null;
  duration_seconds?: number | null;
  telnyx_recording_id?: string | null;
  recording_url?: string | null;
}

interface PaginationMeta { page: number; totalPages: number; hasPrev: boolean; hasNext: boolean; total: number }

export default function CallLogTable({ calls, loading, pagination, setPage, playingId, setPlayingId, audioRef }: { calls: CallRow[]; loading: boolean; pagination?: PaginationMeta; setPage: (page: number) => void; playingId: string | null; setPlayingId: (id: string | null) => void; audioRef: React.MutableRefObject<HTMLAudioElement | null> }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead>Direction</TableHead><TableHead>Contact</TableHead><TableHead className="hidden lg:table-cell">Handled by</TableHead><TableHead>Status</TableHead><TableHead>Recording</TableHead><TableHead className="text-right">Duration</TableHead><TableHead className="hidden md:table-cell text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? Array.from({ length: 8 }).map((_, idx) => <TableRow key={idx}><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>) : null}
            {!loading && calls.length === 0 ? <TableRow><TableCell colSpan={7} className="py-16 text-center text-muted-foreground"><Phone className="mx-auto mb-2 h-8 w-8" />No calls yet</TableCell></TableRow> : null}
            {!loading && calls.map((call) => {
              const name = contactName(call);
              const initials = name.split(" ").map((x) => x[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
              return <TableRow key={call.id} className="hover:bg-muted/30"><TableCell>{call.direction === "inbound" ? <span className="inline-flex items-center gap-2 text-emerald-600"><PhoneIncoming className="h-4 w-4" />Inbound</span> : <span className="inline-flex items-center gap-2 text-blue-600"><PhoneOutgoing className="h-4 w-4" />Outbound</span>}</TableCell><TableCell><div className="flex items-center gap-3"><Avatar className="h-8 w-8"><AvatarFallback>{initials || "UC"}</AvatarFallback></Avatar><div><p className="font-medium">{name}</p><p className="text-xs text-muted-foreground">{formatPhone(externalNumber(call))}</p></div></div></TableCell><TableCell className="hidden lg:table-cell">{handledBy(call)}</TableCell><TableCell><CallStatusBadge status={call.status} /></TableCell><TableCell><RecordingPlayer telnyxRecordingId={call.telnyx_recording_id} recordingUrl={call.recording_url} status={call.status} playingId={playingId} setPlayingId={setPlayingId} audioRef={audioRef} /></TableCell><TableCell className="text-right font-mono">{formatDuration(call.duration_seconds)}</TableCell><TableCell className="hidden md:table-cell text-right text-muted-foreground">{relativeCallTime(call.started_at)}</TableCell></TableRow>;
            })}
          </TableBody>
        </Table>
      </div>
      <div className="border-t px-4 py-3">
        <Pagination className="justify-between"><div className="text-sm text-muted-foreground">{pagination?.total ?? 0} calls</div><PaginationContent><PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (pagination?.hasPrev) setPage(pagination.page - 1); }} className={!pagination?.hasPrev ? "pointer-events-none opacity-50" : ""} /></PaginationItem><PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); if (pagination?.hasNext) setPage(pagination.page + 1); }} className={!pagination?.hasNext ? "pointer-events-none opacity-50" : ""} /></PaginationItem></PaginationContent></Pagination>
      </div>
    </div>
  );
}
