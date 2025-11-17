'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Phone,
  PhoneOff,
  PhoneIncoming,
  PhoneOutgoing,
  MicOff,
  Mic,
  Pause,
  Play,
  LogOut,
  Loader2,
  CheckCircle,
  XCircle,
  Circle,
  PhoneForwarded
} from 'lucide-react';
import { getAccessToken, useAgentTelnyx } from '@/components/agents/AgentTelnyxProvider';
import { TransferDialog } from '@/components/agents/TransferDialog';
import { AttendedTransferControl } from '@/components/agents/AttendedTransferControl';
import { OutboundDialer } from '@/components/agents/OutboundDialer';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { toast } from 'sonner';

export async function safeJson(res: Response) {
  const ct = res.headers.get('content-type') || ''
  if (!res.ok) {
    if (ct.includes('text/html')) {
      throw new Error(
        'This preview is protected by Vercel. Use the Production URL or sign in.',
      )
    }
    try {
      const b = await res.json()
      throw new Error(b?.error || `HTTP ${res.status}`)
    } catch {
      throw new Error(`HTTP ${res.status}`)
    }
  }
  if (ct.includes('text/html')) {
    throw new Error(
      'This preview is protected by Vercel. Use the Production URL or sign in.',
    )
  }
  return res.json()
}

interface Agent {
  id: string;
  email: string;
  display_name: string;
  status: 'available' | 'busy' | 'offline';
  sip_username?: string | null;
}

export default function AgentPortalContent({
  initialAgent,
  missingVoice,
}: {
  initialAgent: Agent;
  missingVoice: string[];
}) {
  const router = useRouter();
  const [agent, setAgent] = useState<Agent>(initialAgent);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [attendedTransfer, setAttendedTransfer] = useState<{
    consultLegId: string;
    destination: string;
  } | null>(null);
  const [callLegIds, setCallLegIds] = useState<{
    customerLegId: string;
    agentLegId: string;
  } | null>(null);
  const [isAnswering, setIsAnswering] = useState(false);
  const [provisioning, setProvisioning] = useState(false);

  const {
    device,
    activeCall,
    status: callStatus,
    toggleMute,
    toggleHold,
    disconnectCall,
    answerCall,
    isMuted,
    isOnHold
  } = useAgentTelnyx();

  // Reset isAnswering when call becomes active or ends
  useEffect(() => {
    if (!activeCall ||
      activeCall.state === 'active' ||
      activeCall.state === 'hangup' ||
      activeCall.state === 'destroy') {
      setIsAnswering(false);
    }
    // Also reset if call fails to connect after timeout
    if (isAnswering && activeCall?.state === 'ringing') {
      const timeout = setTimeout(() => {
        if (isAnswering && activeCall?.state === 'ringing') {
          console.log('⚠️ Answer timeout - resetting UI state');
          setIsAnswering(false);
        }
      }, 15000); // 15 second timeout
      return () => clearTimeout(timeout);
    }
  }, [activeCall?.state, isAnswering]);

  // Poll for active call leg IDs when there's an active call
  useEffect(() => {
    if (!activeCall) {
      // Clear call leg IDs when no active call
      setCallLegIds(null);
      setAttendedTransfer(null);
      setIsAnswering(false);
      return;
    }

    const fetchCallLegIds = async () => {
      try {
        const data = await safeJson(await fetch('/api/agents/active-call', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAccessToken()}` },
        }))
        if (data.active_call) {
          setCallLegIds({
            customerLegId: data.active_call?.customerLegId,
            agentLegId: data.active_call?.agentLegId,
          })

          if (
            attendedTransfer &&
            data.active_call.consultLegId &&
            !attendedTransfer.consultLegId
          ) {
            setAttendedTransfer({
              ...attendedTransfer,
              consultLegId: data.active_call.consultLegId,
            })
          }
        }
      } catch (error) {
        console.error('Failed to fetch call leg IDs:', error)
      }
    }

    // Fetch immediately
    fetchCallLegIds();

    // // Then poll every 2 seconds
    // const interval = setInterval(fetchCallLegIds, 2000);

    // return () => clearInterval(interval);
  }, [activeCall]);

  const updateStatus = async (newStatus: 'available' | 'offline') => {
    if (!agent) return;

    setStatusLoading(true);
    setError('');

    try {
      await safeJson(
        await fetch(`/api/agents/${agent.id}/status`, {
          method: "PATCH",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        }),
      )
      setAgent({ ...agent, status: newStatus })
    } catch (error: any) {
      setError(error.message)
    } finally {
      setStatusLoading(false)
    }
  };

  const handleLogout = async () => {
    const client = supabaseBrowser();
    await client.auth.signOut();
    router.push('/agents/login');
  };

  const handleProvisionCredential = async () => {
    try {
      setProvisioning(true);
      await safeJson(
        await fetch('/api/agents/create-credential', {
          method: 'POST',
        }),
      );
      window.location.reload();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to provision credential');
      setProvisioning(false);
    }
  };

  const handleTransferStart = (type: 'blind' | 'attended', destination: string) => {
    if (type === 'attended') {
      // For attended transfer, we'll receive consult leg ID from the API response
      // For now, mark that we're in attended transfer mode
      setAttendedTransfer({
        consultLegId: '', // Will be populated by polling
        destination
      });
    }
  };

  const handleTransferComplete = () => {
    setAttendedTransfer(null);
    // The call will be disconnected automatically
  };

  const handleTransferCancel = () => {
    setAttendedTransfer(null);
  };

  if (!agent) return null;

  const sipConfigured = Boolean(agent.sip_username);

  const getStatusIcon = () => {
    switch (agent.status) {
      case 'available':
        return <CheckCircle className="h-4 w-4" />;
      case 'busy':
        return <XCircle className="h-4 w-4" />;
      case 'offline':
        return <Circle className="h-4 w-4" />;
    }
  };

  const getStatusColor = () => {
    switch (agent.status) {
      case 'available':
        return 'bg-green-500';
      case 'busy':
        return 'bg-red-500';
      case 'offline':
        return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Agent Portal</h1>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>

        {missingVoice.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              Missing Telnyx env vars: {missingVoice.join(', ')}
            </AlertDescription>
          </Alert>
        )}

        {!sipConfigured && (
          <Alert variant="destructive">
            <AlertDescription>
              No SIP username configured. Please contact your administrator before placing calls.
            </AlertDescription>
          </Alert>
        )}

        {/* Agent Info */}
        <Card>
          <CardHeader>
            <CardTitle>Welcome, {agent.display_name}</CardTitle>
            <CardDescription>{agent.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${getStatusColor()}`} />
                <span className="font-medium capitalize">{agent.status}</span>
              </div>
              {agent.status !== 'busy' && (
                <Button
                  onClick={() => updateStatus(agent.status === 'offline' ? 'available' : 'offline')}
                  disabled={statusLoading}
                  variant={agent.status === 'offline' ? 'default' : 'outline'}
                >
                  {statusLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : agent.status === 'offline' ? (
                    <Phone className="mr-2 h-4 w-4" />
                  ) : (
                    <PhoneOff className="mr-2 h-4 w-4" />
                  )}
                  {agent.status === 'offline' ? 'Go Available' : 'Go Offline'}
                </Button>
              )}
            </div>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              <p>
                SIP Username:{' '}
                {sipConfigured ? (
                  <span className="font-mono text-foreground">{agent.sip_username}</span>
                ) : (
                  <span className="font-semibold text-destructive">Not configured</span>
                )}
              </p>
            </div>
            {!sipConfigured && (
              <Button
                className="mt-4"
                onClick={handleProvisionCredential}
                disabled={provisioning}
              >
                {provisioning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Provision Telnyx Credential
              </Button>
            )}
            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* WebRTC Status */}
        <Card>
          <CardHeader>
            <CardTitle>Connection Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={device ? 'default' : 'secondary'}>
                  {device ? 'Connected' : 'Not Connected'}
                </Badge>
                {callStatus === 'connecting' && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Phone System: {device ? 'Connected' : 'Disconnected'}</p>
                {activeCall && <p>Call Status: Active</p>}
              </div>
              {agent.status === 'available' && !device && (
                <p className="text-sm text-muted-foreground">
                  Connecting to call system...
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Outbound Dialer */}
        {sipConfigured && agent.status === 'available' && !activeCall && device && callStatus === 'idle' && (
          <OutboundDialer />
        )}

        {/* Active Call */}
        {activeCall && !attendedTransfer && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {activeCall.direction === 'outbound' ? (
                  <PhoneOutgoing className="h-5 w-5" />
                ) : (
                  <PhoneIncoming className="h-5 w-5" />
                )}
                {activeCall.direction === 'outbound' ? 'Outbound Call' : 'Active Call'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {activeCall.direction === 'outbound' ? 'Calling' : 'Customer Number'}
                  </p>
                  <p className="font-mono">{activeCall.remoteId || 'Connecting...'}</p>
                  {activeCall.state && (
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-muted-foreground">
                        Status: {isAnswering ? 'Answering...' :
                          activeCall.state === 'active' ? 'Connected' :
                            activeCall.state === 'held' ? 'On Hold' :
                              activeCall.state === 'ringing' ? (
                                activeCall.direction === 'inbound' ? 'Incoming...' : 'Dialing customer...'
                              ) :
                                activeCall.state === 'trying' ? 'Connecting...' :
                                  activeCall.state === 'new' ? 'Initializing...' :
                                    activeCall.state}
                      </p>
                      {(isAnswering || activeCall.state === 'trying' || activeCall.state === 'ringing' || activeCall.state === 'new') && (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  )}
                  {isOnHold && (activeCall.state === 'active' || activeCall.state === 'held') && (
                    <div className="flex items-center gap-2 mt-2 p-2 bg-amber-50 dark:bg-amber-950 rounded">
                      <Pause className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        Customer on hold (music playing)
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {/* Always show control buttons for any active call */}
                  {activeCall.state === 'ringing' && activeCall.direction === 'inbound' && !isAnswering ? (
                    <>
                      <Button
                        variant="default"
                        onClick={async () => {
                          console.log('🔔 Answer button clicked');
                          console.log('📞 Active call state:', activeCall.state);
                          console.log('📞 Active call direction:', activeCall.direction);

                          // Set answering state for immediate UI feedback
                          setIsAnswering(true);

                          // Call the answer function
                          await answerCall();

                          // The UI will now show call controls immediately
                        }}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Phone className="h-4 w-4" />
                        <span className="ml-2">Answer</span>
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          console.log('📞 Rejecting incoming call');
                          disconnectCall();
                        }}
                      >
                        <PhoneOff className="h-4 w-4" />
                        <span className="ml-2">Reject</span>
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant={isMuted ? 'destructive' : 'outline'}
                        onClick={toggleMute}
                        disabled={attendedTransfer !== null || isOnHold}
                      >
                        {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant={isOnHold ? 'secondary' : 'outline'}
                        onClick={toggleHold}
                        disabled={attendedTransfer !== null}
                        title={isOnHold ? "Resume call (stop hold music)" : "Put on hold (play music to customer)"}
                      >
                        {isOnHold ? (
                          <>
                            <Play className="h-4 w-4" />
                            <span className="ml-1 text-xs">Resume</span>
                          </>
                        ) : (
                          <>
                            <Pause className="h-4 w-4" />
                            <span className="ml-1 text-xs">Hold</span>
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowTransferDialog(true)}
                        disabled={attendedTransfer !== null || isOnHold || !activeCall?.telnyxIDs.telnyxSessionId}
                        title={!activeCall?.telnyxIDs.telnyxSessionId ? "Call session IDs not available" : isOnHold ? "Cannot transfer while on hold" : "Transfer call"}
                      >
                        <PhoneForwarded className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button
                    variant="destructive"
                    onClick={disconnectCall}
                    disabled={attendedTransfer !== null}
                  >
                    <PhoneOff className="h-4 w-4" />
                    <span className="ml-2">Hang Up</span>
                  </Button>
                </div>
                {!callLegIds && (
                  <p className="text-xs text-muted-foreground">
                    Note: Transfer requires call leg IDs from webhook integration
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Attended Transfer Control */}
        {attendedTransfer && callLegIds && (
          <AttendedTransferControl
            customerLegId={activeCall?.telnyxIDs.telnyxSessionId!}
            agentLegId={callLegIds.agentLegId}
            consultLegId={attendedTransfer?.consultLegId!}
            destination={attendedTransfer.destination}
            onComplete={handleTransferComplete}
            onCancel={handleTransferCancel}
          />
        )}

        {/* Instructions */}
        {agent.status === 'available' && !activeCall && (
          <Card>
            <CardHeader>
              <CardTitle>Ready for Calls</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  You are now available to receive calls. When a customer calls,
                  you will be automatically connected. Keep this window open.
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> If you don't receive a call within 10 minutes,
                  the connection may timeout. Simply click "Go Available" again to reconnect.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Transfer Dialog */}
      {activeCall?.telnyxIDs.telnyxSessionId && (
        <TransferDialog
          open={showTransferDialog}
          onOpenChange={setShowTransferDialog}
          sessionId={activeCall?.telnyxIDs.telnyxSessionId!}
          agentLegId={callLegIds?.agentLegId!}
          onTransferStart={handleTransferStart}
        />
      )}
    </div>
  );
}
