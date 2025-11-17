'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AudioPlayer } from './AudioPlayer';
import { 
  Phone, 
  PhoneIncoming, 
  PhoneOutgoing,
  User,
  Clock,
  Mic,
  MicOff,
  ChevronDown,
  ChevronUp,
  Calendar,
  UserCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Call {
  call_sid: string;
  from_number: string;
  to_number: string;
  from_agent_id: string | null;
  buyer_id: string | null;
  direction: 'inbound' | 'outbound';
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration: number | null;
  status: string;
  recording_url: string | null;
  telnyx_recording_id: string | null;
  recording_confidence?: number | null;
  from_agent?: {
    id: string;
    email: string;
    display_name: string;
  };
  buyer?: {
    id: string;
    fname?: string;
    lname?: string;
    phone: string;
  };
}

interface CallHistoryTableProps {
  calls: Call[];
  onCallClick?: (call: Call) => void;
}

export function CallHistoryTable({ calls, onCallClick }: CallHistoryTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (callSid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(callSid)) {
      newExpanded.delete(callSid);
    } else {
      newExpanded.add(callSid);
    }
    setExpandedRows(newExpanded);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '-';
    // Handle SIP URIs
    if (phone.includes('sip:') || phone.includes('@')) {
      return 'SIP Call';
    }
    // Format as (XXX) XXX-XXXX if it's a 10-digit US number
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    if (cleaned.length === 11 && cleaned[0] === '1') {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const getStatusBadge = (call: Call) => {
    if (!call.answered_at) {
      return <Badge variant="secondary" className="font-normal">Missed</Badge>;
    }
    if (call.status === 'completed') {
      return <Badge variant="default" className="font-normal">Completed</Badge>;
    }
    if (call.status === 'busy') {
      return <Badge variant="destructive" className="font-normal">Busy</Badge>;
    }
    return <Badge variant="outline" className="font-normal">{call.status}</Badge>;
  };

  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Phone className="h-12 w-12 mb-4 opacity-20" />
        <p className="text-lg font-medium">No calls found</p>
        <p className="text-sm">Adjust your filters or make some calls to see them here</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10 text-center"></TableHead>
            <TableHead className="min-w-[140px]">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date/Time
              </div>
            </TableHead>
            <TableHead className="min-w-[100px]">Direction</TableHead>
            <TableHead className="min-w-[140px]">From</TableHead>
            <TableHead className="min-w-[140px]">To</TableHead>
            <TableHead className="min-w-[120px]">
              <div className="flex items-center gap-2">
                <UserCircle className="h-4 w-4" />
                Agent
              </div>
            </TableHead>
            <TableHead className="min-w-[120px]">Customer</TableHead>
            <TableHead className="min-w-[80px] text-center">
              <div className="flex items-center justify-center gap-2">
                <Clock className="h-4 w-4" />
                Duration
              </div>
            </TableHead>
            <TableHead className="min-w-[100px]">Status</TableHead>
            <TableHead className="min-w-[100px] text-center">
              <div className="flex items-center justify-center gap-2">
                <Mic className="h-4 w-4" />
                Recording
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {calls.map((call) => (
            <>
              <TableRow 
                key={call.call_sid}
                className={cn(
                  "cursor-pointer transition-colors",
                  expandedRows.has(call.call_sid) ? "bg-muted/50" : "hover:bg-muted/30"
                )}
                onClick={() => onCallClick?.(call)}
              >
                <TableCell className="text-center">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => toggleRow(call.call_sid, e)}
                  >
                    {expandedRows.has(call.call_sid) ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium text-sm">
                      {format(new Date(call.started_at), 'MMM d, yyyy')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(call.started_at), 'h:mm a')}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {call.direction === 'inbound' ? (
                      <>
                        <PhoneIncoming className="h-4 w-4 text-green-600" />
                        <span className="text-sm">Inbound</span>
                      </>
                    ) : (
                      <>
                        <PhoneOutgoing className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">Outbound</span>
                      </>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-mono text-sm">
                    {formatPhoneNumber(call.from_number)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-mono text-sm">
                    {formatPhoneNumber(call.to_number)}
                  </div>
                </TableCell>
                <TableCell>
                  {call.from_agent ? (
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-3 w-3" />
                      </div>
                      <span className="text-sm truncate max-w-[100px]">
                        {call.from_agent.display_name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {call.buyer ? (
                    <span className="text-sm truncate max-w-[120px] block">
                      {call.buyer.fname || ''} {call.buyer.lname || ''}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-sm font-medium">
                    {formatDuration(call.duration)}
                  </span>
                </TableCell>
                <TableCell>
                  {getStatusBadge(call)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-center">
                    {call.telnyx_recording_id || call.recording_url ? (
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs text-muted-foreground">
                          {call.recording_confidence ? 
                            `${Math.round(call.recording_confidence * 100)}%` : 
                            'Available'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <MicOff className="h-4 w-4 text-muted-foreground/50" />
                        <span className="text-xs text-muted-foreground">None</span>
                      </div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
              {expandedRows.has(call.call_sid) && (
                <TableRow>
                  <TableCell colSpan={10} className="bg-muted/20 border-t-0">
                    <div className="py-4">
                      {call.telnyx_recording_id || call.recording_url ? (
                        <div className="max-w-2xl mx-auto">
                          <div className="mb-2 text-sm font-medium text-muted-foreground">
                            Call Recording
                          </div>
                          <AudioPlayer 
                            recordingId={call.telnyx_recording_id} 
                            callSid={call.call_sid} 
                          />
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <MicOff className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                          <p className="text-sm text-muted-foreground">
                            No recording available for this call
                          </p>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
