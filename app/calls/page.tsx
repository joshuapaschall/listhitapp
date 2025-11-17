'use client';

import { useState, useEffect } from 'react';
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Phone, Mic, Download, Calendar, Clock, Voicemail, RefreshCw, Play, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from 'date-fns';

interface CallRecord {
  id: string;
  from_number: string;
  to_number: string;
  direction: 'inbound' | 'outbound';
  duration: number;
  started_at: string;
  recording_url?: string;
  recording_id?: string;
  from_agent_name?: string;
  status?: string;
}

interface TelnyxRecording {
  id: string;
  recording_id: string;
  duration_millis: number;
  created_at: string;
  metadata?: {
    from?: string;
    to?: string;
  };
  confidence?: 'high' | 'medium' | 'low';
  channels?: string;
}

export default function CallsPage() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [voicemails, setVoicemails] = useState<TelnyxRecording[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(true);
  const [loadingVoicemails, setLoadingVoicemails] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const { toast } = useToast();


  // Fetch call recordings
  const fetchCalls = async () => {
    setLoadingCalls(true);
    try {
      const response = await fetch('/api/calls/history?hasRecording=true&pageSize=50&sortBy=started_at&sortOrder=desc');
      if (!response.ok) throw new Error('Failed to fetch calls');
      
      const data = await response.json();
      setCalls(data.calls || []);
    } catch (error) {
      console.error('Error fetching calls:', error);
      toast({
        title: 'Error',
        description: 'Failed to load call recordings',
        variant: 'destructive'
      });
    } finally {
      setLoadingCalls(false);
    }
  };

  // Fetch voicemails from Telnyx API
  const fetchVoicemails = async () => {
    setLoadingVoicemails(true);
    try {
      const response = await fetch('/api/voicemails/poll');
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Failed to fetch voicemails');
      
      setVoicemails(data.voicemails || []);
      
      // Show detailed stats in toast
      if (data.stats) {
        const { total_recordings, call_recordings, confirmed_voicemails, probable_voicemails } = data.stats;
        toast({
          title: 'Recording Analysis Complete',
          description: `${total_recordings} recordings: ${call_recordings} calls, ${confirmed_voicemails} confirmed + ${probable_voicemails} probable voicemails`,
        });
      } else {
        toast({
          title: 'Voicemails Updated',
          description: `Found ${data.voicemails?.length || 0} voicemails`,
        });
      }
    } catch (error) {
      console.error('Error fetching voicemails:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch voicemails',
        variant: 'destructive'
      });
    } finally {
      setLoadingVoicemails(false);
    }
  };

  // Play recording
  const playRecording = async (recordingId: string) => {
    // Stop current playback if any
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    if (playingId === recordingId) {
      setPlayingId(null);
      return;
    }

    try {
      const newAudio = new Audio(`/api/recordings/${recordingId}/stream`);
      
      newAudio.onended = () => {
        setPlayingId(null);
      };
      
      newAudio.onerror = (e) => {
        console.error('Audio playback error:', e);
        setPlayingId(null);
        toast({
          title: 'Playback Error',
          description: 'Failed to play recording',
          variant: 'destructive'
        });
      };

      await newAudio.play();
      setAudio(newAudio);
      setPlayingId(recordingId);
    } catch (error) {
      console.error('Failed to play recording:', error);
      toast({
        title: 'Playback Error',
        description: 'Failed to play recording',
        variant: 'destructive'
      });
    }
  };

  // Format duration
  const formatDuration = (seconds?: number, millis?: number) => {
    const totalSeconds = seconds || Math.floor((millis || 0) / 1000);
    if (!totalSeconds) return '0:00';
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format phone number
  const formatPhoneNumber = (phone: string) => {
    if (!phone) return 'Unknown';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned[0] === '1') {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  useEffect(() => {
    fetchCalls();
  }, []);

  return (
    <MainLayout>
      <div className="p-4 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calls & Voicemails</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Listen to call recordings and voicemail messages from Telnyx
          </p>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="recordings" className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="recordings">
              <Phone className="h-4 w-4 mr-2" />
              Call Recordings
            </TabsTrigger>
            <TabsTrigger value="voicemails">
              <Voicemail className="h-4 w-4 mr-2" />
              Voicemails
            </TabsTrigger>
          </TabsList>
          
          {/* Call Recordings Tab */}
          <TabsContent value="recordings" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Call Recordings</CardTitle>
                    <CardDescription className="mt-1">
                      Recent calls with recordings available
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={fetchCalls} 
                    disabled={loadingCalls}
                    variant="outline"
                    size="sm"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loadingCalls ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingCalls ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground">Loading recordings...</p>
                  </div>
                ) : calls.length > 0 ? (
                  <div className="space-y-3">
                    {calls.map((call) => (
                      <div
                        key={call.id}
                        className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {formatPhoneNumber(call.from_number)} → {formatPhoneNumber(call.to_number)}
                              </span>
                              <Badge variant={call.direction === 'inbound' ? 'secondary' : 'default'}>
                                {call.direction}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(call.started_at), 'MMM d, yyyy h:mm a')}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDuration(call.duration)}
                              </span>
                              {call.from_agent_name && (
                                <span>Agent: {call.from_agent_name}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {call.recording_id && (
                              <>
                                <Button
                                  size="sm"
                                  variant={playingId === call.recording_id ? "default" : "outline"}
                                  onClick={() => playRecording(call.recording_id!)}
                                >
                                  {playingId === call.recording_id ? (
                                    <>
                                      <Pause className="h-4 w-4 mr-2" />
                                      Pause
                                    </>
                                  ) : (
                                    <>
                                      <Play className="h-4 w-4 mr-2" />
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
                                    href={`/api/recordings/${call.recording_id}/stream`}
                                    download={`call-${call.id}.mp3`}
                                  >
                                    <Download className="h-4 w-4" />
                                  </a>
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Mic className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No call recordings found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Voicemails Tab */}
          <TabsContent value="voicemails" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Voicemail Messages</CardTitle>
                    <CardDescription className="mt-1">
                      Recordings from unanswered calls identified directly from Telnyx API
                    </CardDescription>
                    <p className="text-xs text-muted-foreground mt-2">
                      Automatically analyzes recordings to identify voicemails
                    </p>
                  </div>
                  <Button 
                    onClick={fetchVoicemails} 
                    disabled={loadingVoicemails}
                    variant="outline"
                    size="sm"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loadingVoicemails ? 'animate-spin' : ''}`} />
                    {loadingVoicemails ? 'Analyzing...' : 'Load Voicemails'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingVoicemails ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground">Analyzing recordings from Telnyx...</p>
                  </div>
                ) : voicemails.length > 0 ? (
                  <div className="space-y-3">
                    {voicemails.map((voicemail) => (
                      <div
                        key={voicemail.id}
                        className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <Voicemail className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {formatPhoneNumber(voicemail.metadata?.from || '')} → {formatPhoneNumber(voicemail.metadata?.to || '')}
                              </span>
                              {voicemail.confidence === 'high' ? (
                                <Badge variant="default" className="text-xs">Confirmed</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Probable</Badge>
                              )}
                              {voicemail.channels === 'single' && (
                                <Badge variant="outline" className="text-xs">Single Ch</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(voicemail.created_at), 'MMM d, yyyy h:mm a')}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDuration(undefined, voicemail.duration_millis)}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={playingId === voicemail.id ? "default" : "outline"}
                              onClick={() => playRecording(voicemail.id)}
                            >
                              {playingId === voicemail.id ? (
                                <>
                                  <Pause className="h-4 w-4 mr-2" />
                                  Pause
                                </>
                              ) : (
                                <>
                                  <Play className="h-4 w-4 mr-2" />
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
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Voicemail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No voicemails found</p>
                    <p className="text-sm mt-2">Click "Load Voicemails" to check for messages</p>
                    <p className="text-xs mt-4 max-w-md mx-auto">
                      Voicemails are identified by analyzing recordings from Telnyx API
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
