'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { TransferService } from '@/lib/transfer-service';
import { Phone, PhoneForwarded, Loader2 } from 'lucide-react';
import { safeJson } from '@/app/agents/portal/AgentPortalContent';
import { getAccessToken } from './AgentTelnyxProvider';

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  agentLegId: string;
  onTransferStart?: (type: 'blind' | 'attended', destination: string) => void;
}

export function TransferDialog({
  open,
  onOpenChange,
  sessionId,
  agentLegId,
  onTransferStart
}: TransferDialogProps) {
  const [transferType, setTransferType] = useState<'blind' | 'attended'>('blind');
  const [destination, setDestination] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTransfer = async () => {
    setError('');
    
    // Validate destination
    if (!TransferService.validateDestination(destination)) {
      setError('Please enter a valid phone number (+1234567890), extension (123), or SIP URI');
      return;
    }

    const formattedDestination = TransferService.formatDestination(destination);
    setLoading(true);

    try {
      if (transferType === 'blind') {
        await TransferService.blindTransfer(sessionId, formattedDestination);
        onOpenChange(false);
      } else {
              const data = await safeJson(await fetch('/api/agents/active-call', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAccessToken()}` },
              }))
        // For attended transfer, start the consult call
        const result = await TransferService.startAttendedTransfer(
         data?.active_call?.customerLegId, data?.active_call?.agentLegId,
          formattedDestination
        );
        
        // Notify parent component to handle attended transfer flow
        if (onTransferStart) {
          onTransferStart('attended', formattedDestination);
        }
        onOpenChange(false);
      }
    } catch (err: any) {
      setError(err.message || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Transfer Call</DialogTitle>
          <DialogDescription>
            Transfer the current call to another agent or phone number.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Transfer Type</Label>
            <RadioGroup value={transferType} onValueChange={(value: 'blind' | 'attended') => setTransferType(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="blind" id="blind" />
                <Label htmlFor="blind" className="font-normal cursor-pointer">
                  <div>
                    <div className="font-medium">Blind Transfer</div>
                    <div className="text-sm text-muted-foreground">
                      Transfer immediately without speaking to the destination first
                    </div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="attended" id="attended" />
                <Label htmlFor="attended" className="font-normal cursor-pointer">
                  <div>
                    <div className="font-medium">Attended Transfer</div>
                    <div className="text-sm text-muted-foreground">
                      Speak with the destination before completing the transfer
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="destination">Destination</Label>
            <Input
              id="destination"
              placeholder="+1234567890, 123, or sip:agent@domain.com"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              disabled={loading}
            />
            <p className="text-sm text-muted-foreground">
              Enter a phone number, extension, or SIP URI
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleTransfer} disabled={loading || !destination}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Transferring...
              </>
            ) : (
              <>
                <PhoneForwarded className="mr-2 h-4 w-4" />
                {transferType === 'blind' ? 'Transfer' : 'Start Transfer'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
