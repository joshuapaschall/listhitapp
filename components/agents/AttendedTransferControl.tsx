'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TransferService } from '@/lib/transfer-service';
import { PhoneCall, PhoneOff, Check, X, Loader2 } from 'lucide-react';
import { safeJson } from '@/app/agents/portal/AgentPortalContent';
import { getAccessToken } from './AgentTelnyxProvider';

interface AttendedTransferControlProps {
  customerLegId: string;
  agentLegId: string;
  consultLegId: string;
  destination: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

export function AttendedTransferControl({
  customerLegId,
  agentLegId,
  consultLegId,
  destination,
  onComplete,
  onCancel
}: AttendedTransferControlProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'consulting' | 'bridged'>('consulting');

  const handleBridgeConsult = async () => {
    setError('');
    setLoading(true);

    try {
      const data = await safeJson(await fetch('/api/agents/active-call', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAccessToken()}` },
      }))
      await TransferService.bridgeAgentToConsult(data?.active_call?.customerLegId, data?.active_call?.agentLegId, data?.active_call?.consultLegId);
      setStep('bridged');
    } catch (err: any) {
      setError(err.message || 'Failed to connect to consult');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setError('');
    setLoading(true);

    try {
      const data = await safeJson(await fetch('/api/agents/active-call', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAccessToken()}` },
      }))
      await TransferService.completeAttendedTransfer(data?.active_call?.customerLegId, data?.active_call?.agentLegId, data?.active_call?.consultLegId);
      if (onComplete) onComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to complete transfer');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setError('');
    setLoading(true);

    try {
      const data = await safeJson(await fetch('/api/agents/active-call', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAccessToken()}` },
      }))
      await TransferService.cancelAttendedTransfer(data?.active_call?.customerLegId, data?.active_call?.agentLegId, data?.active_call?.consultLegId);
      if (onCancel) onCancel();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel transfer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PhoneCall className="h-5 w-5" />
          Attended Transfer in Progress
        </CardTitle>
        <CardDescription>
          {step === 'consulting'
            ? `Customer is on hold. Calling ${destination}...`
            : `Speaking with ${destination}`
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="text-sm space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span>Customer: On hold with music</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <span>You: {step === 'consulting' ? 'Waiting for answer' : 'Connected to consult'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${step === 'bridged' ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
              <span>Consult: {destination}</span>
            </div>
          </div>

          <div className="flex gap-2">
            {step === 'consulting' && (
              <Button
                onClick={handleBridgeConsult}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PhoneCall className="mr-2 h-4 w-4" />
                )}
                Connect to Consult
              </Button>
            )}

            {step === 'bridged' && (
              <>
                <Button
                  variant="default"
                  onClick={handleComplete}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Complete Transfer
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleCancel}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <X className="mr-2 h-4 w-4" />
                  )}
                  Cancel Transfer
                </Button>
              </>
            )}
          </div>

          {step === 'bridged' && (
            <p className="text-xs text-muted-foreground text-center">
              Complete: Connect customer to consult and disconnect yourself<br />
              Cancel: Return to customer and disconnect consult
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
