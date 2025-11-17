'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Phone, Mic, Download, Calendar, Clock, Voicemail, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TelnyxCall {
  call_session_id: string;
  from: string;
  to: string;
  direction: string;
  started_at: string;
  ended_at?: string;
  answered_at?: string;
  duration_ms?: number;
  legs: string[];
  recordings: Array<{
    recording_id: string;
    format: string;
    channels: string;
    duration_ms: number;
    download_urls: {
      mp3?: string;
      wav?: string;
    };
  }>;
}

interface TelnyxRecording {
  id: string;
  recording_id: string;
  call_control_id?: string;
  call_session_id?: string;
  duration_millis: number;
  format: string;
  channels: string;
  created_at: string;
  updated_at: string;
  download_urls: {
    mp3?: string;
    wav?: string;
  };
  metadata?: {
    from?: string;
    to?: string;
    direction?: string;
  };
  status: string;
  type?: string; // 'voicemail' or 'recording'
}

export function TelnyxCallHistory() {
  const [phoneA, setPhoneA] = useState('');
  const [phoneB, setPhoneB] = useState('');
  const [dateFrom, setDateFrom] = useState(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [dateTo, setDateTo] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [loading, setLoading] = useState(false);
  const [loadingVoicemails, setLoadingVoicemails] = useState(false);
  const [calls, setCalls] = useState<TelnyxCall[]>([]);
  const [voicemails, setVoicemails] = useState<TelnyxRecording[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  const fetchHistory = async () => {
    if (!phoneA || !phoneB) {
      setError('Please enter both phone numbers');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        phoneA,
        phoneB,
        dateFrom: `${dateFrom}T00:00:00Z`,
        dateTo: `${dateTo}T23:59:59Z`
      });

      const response = await fetch(`/api/calls/telnyx-history?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch history');
      }

      setCalls(data.calls || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setCalls([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchVoicemails = async () => {
    setLoadingVoicemails(true);
    setError(null);
    
    try {
      const response = await fetch('/api/voicemails/poll');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch voicemails');
      }

      // The poll endpoint returns voicemails in the format we need
      setVoicemails(data.voicemails || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch voicemails');
      setVoicemails([]);
    } finally {
      setLoadingVoicemails(false);
    }
  };

  const playRecording = async (recording: TelnyxRecording | any) => {
    // Stop current playback if any
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    if (playingId === (recording.id || recording.recording_id)) {
      setPlayingId(null);
      return;
    }

    try {
      // Use the stream endpoint to get fresh URLs
      const recordingId = recording.recording_id || recording.id;
      const newAudio = new Audio(`/api/recordings/${recordingId}/stream`);
      
      newAudio.onended = () => {
        setPlayingId(null);
      };
      
      newAudio.onerror = (e) => {
        console.error('Audio playback error:', e);
        setPlayingId(null);
      };

      await newAudio.play();
      setAudio(newAudio);
      setPlayingId(recordingId);
    } catch (error) {
      console.error('Failed to play recording:', error);
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned[0] === '1') {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="calls" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calls">Call History</TabsTrigger>
          <TabsTrigger value="voicemails">Voicemail Recordings</TabsTrigger>
        </TabsList>
        
        {/* Calls Tab */}
        <TabsContent value="calls" className="space-y-6">
          {/* Search Form */}
          <Card>
            <CardHeader>
              <CardTitle>Telnyx Call History (Pure API)</CardTitle>
            </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="phoneA">Your Phone Number</Label>
              <Input
                id="phoneA"
                type="tel"
                placeholder="+1234567890"
                value={phoneA}
                onChange={(e) => setPhoneA(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="phoneB">Other Phone Number</Label>
              <Input
                id="phoneB"
                type="tel"
                placeholder="+1234567890"
                value={phoneB}
                onChange={(e) => setPhoneB(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dateFrom">From Date</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dateTo">To Date</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          
          <div className="mt-4 flex gap-2">
            <Button onClick={fetchHistory} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <Phone className="h-4 w-4 mr-2" />
                  Fetch History
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {calls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Found {calls.length} call{calls.length !== 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {calls.map((call) => (
                <div
                  key={call.call_session_id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  {/* Call Info */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {formatPhoneNumber(call.from)} → {formatPhoneNumber(call.to)}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          call.direction === 'incoming' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {call.direction}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(call.started_at), 'MMM d, yyyy h:mm a')}
                        </span>
                        {call.duration_ms && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(call.duration_ms)}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Session: {call.call_session_id}
                      </div>
                    </div>
                  </div>

                  {/* Recordings */}
                  {call.recordings.length > 0 && (
                    <div className="border-t pt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Mic className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {call.recordings.length} Recording{call.recordings.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {call.recordings.map((rec, idx) => (
                          <div
                            key={rec.recording_id}
                            className="flex items-center justify-between bg-muted/50 rounded-md p-2"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm">
                                Recording #{idx + 1}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {rec.format.toUpperCase()} • {rec.channels} • {formatDuration(rec.duration_ms)}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  // Play recording using the recording ID
                                  // The stream endpoint will fetch fresh URLs
                                  const audio = new Audio(`/api/recordings/${rec.recording_id}/stream`);
                                  audio.play();
                                }}
                              >
                                Play
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                asChild
                              >
                                <a
                                  href={`/api/recordings/${rec.recording_id}/stream`}
                                  download={`recording-${rec.recording_id}.${rec.format}`}
                                >
                                  <Download className="h-3 w-3" />
                                </a>
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No Recordings */}
                  {call.recordings.length === 0 && (
                    <div className="border-t pt-3 text-sm text-muted-foreground">
                      No recordings available
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

          {/* No Results */}
          {!loading && calls.length === 0 && phoneA && phoneB && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No calls found between these numbers in the selected date range
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        {/* Voicemails Tab */}
        <TabsContent value="voicemails" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Telnyx Voicemail Recordings</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Direct from Telnyx API - Poll for new voicemails
                  </p>
                </div>
                <Button 
                  onClick={fetchVoicemails} 
                  disabled={loadingVoicemails}
                  variant="outline"
                >
                  {loadingVoicemails ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Polling...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Poll Voicemails
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
                  {error}
                </div>
              )}
              
              {/* Voicemail List */}
              {voicemails.length > 0 ? (
                <div className="space-y-4">
                  {voicemails.map((voicemail) => (
                    <div
                      key={voicemail.id}
                      className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Voicemail className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {voicemail.metadata?.from || 'Unknown'} → {voicemail.metadata?.to || 'Unknown'}
                            </span>
                            {voicemail.type === 'voicemail' && (
                              <Badge variant="secondary">Voicemail</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(voicemail.created_at), 'MMM d, yyyy h:mm a')}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(voicemail.duration_millis)}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ID: {voicemail.id}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={playingId === voicemail.id ? "default" : "outline"}
                            onClick={() => playRecording(voicemail)}
                          >
                            {playingId === voicemail.id ? (
                              <>
                                <div className="h-4 w-4 mr-2 flex items-center gap-1">
                                  <span className="w-1 h-4 bg-white animate-pulse rounded-full"></span>
                                  <span className="w-1 h-3 bg-white animate-pulse rounded-full"></span>
                                  <span className="w-1 h-4 bg-white animate-pulse rounded-full"></span>
                                </div>
                                Playing
                              </>
                            ) : (
                              <>
                                <Mic className="h-4 w-4 mr-2" />
                                Play
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                          >
                            <a
                              href={`/api/recordings/${voicemail.id}/stream`}
                              download={`voicemail-${voicemail.id}.mp3`}
                            >
                              <Download className="h-3 w-3" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  {loadingVoicemails ? (
                    <>
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                      <p>Polling for voicemails...</p>
                    </>
                  ) : (
                    <>
                      <Voicemail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No voicemails found</p>
                      <p className="text-sm mt-2">Click "Poll Voicemails" to check for new messages</p>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
