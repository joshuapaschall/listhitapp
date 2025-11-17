"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTelnyxDevice } from "./TelnyxDeviceProvider";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CallModal({ open, onOpenChange }: Props) {
  const {
    activeCall,
    disconnectCall,
    toggleMute,
    unmute,
    toggleHold,
    unhold,
    startRecording,
    stopRecording,
    sendDTMF,
    transfer,
    joinConference,
    addToConference,
  } = useTelnyxDevice();
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [held, setHeld] = useState(false);
  const [recording, setRecording] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferNumber, setTransferNumber] = useState("");
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [participantNumber, setParticipantNumber] = useState("");
  const [inConference, setInConference] = useState(false);

  useEffect(() => {
    if (!activeCall || !open) return;
    const start = Date.now();
    const id = setInterval(() => {
      setSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [activeCall, open]);

  useEffect(() => {
    if (!activeCall && open) {
      // Reset all states when call ends
      setMuted(false);
      setHeld(false);
      setRecording(false);
      setSeconds(0);
      onOpenChange(false);
    }
  }, [activeCall, open, onOpenChange]);

  // Extract phone number from various possible fields
  const getPhoneNumber = () => {
    if (!activeCall) return "Unknown";
    
    const call = activeCall as any;
    
    // For outbound calls
    if (call.direction === "outbound") {
      return call.destinationNumber || 
             call.parameters?.To || 
             call.params?.To ||
             call.params?.to ||
             "Unknown";
    }
    
    // For inbound calls
    return call.remoteCallerNumber || 
           call.remoteIdentity || 
           call.from ||
           call.remoteNumber ||
           call.callerIdNumber ||
           call.parameters?.From ||
           call.params?.From ||
           call.params?.from ||
           "Unknown";
  };
  
  const number = getPhoneNumber();

  const handleMute = () => {
    if (!activeCall) return;
    try {
      if (muted) {
        unmute();
      } else {
        toggleMute();
      }
      setMuted(!muted);
    } catch (err) {
      console.error("Mute/unmute failed:", err);
    }
  };

  const handleHold = async () => {
    if (!activeCall) return;
    try {
      if (held) {
        await unhold();
      } else {
        await toggleHold();
      }
      setHeld(!held);
    } catch (err) {
      console.error("Hold/unhold failed:", err);
    }
  };

  const handleTransfer = async () => {
    if (!transferNumber.trim()) return;
    
    // Simple approach - just make a new call
    alert(`To transfer: \n1. Tell the caller you'll connect them\n2. Hang up this call\n3. Call ${transferNumber}\n4. Introduce them and hang up`);
    setShowTransfer(false);
    setTransferNumber("");
  };

  const handleJoinConference = async () => {
    // Simple approach - remove conference for WebRTC
    alert("Conference calls not available. To add another person:\n1. Ask them to call you\n2. Or hang up and call them");
    setShowConference(false);
  };

  const handleAddParticipant = async () => {
    if (!participantNumber.trim()) return;
    
    try {
      await addToConference(participantNumber);
      setShowAddParticipant(false);
      setParticipantNumber("");
      alert(`Added ${participantNumber} to conference`);
    } catch (err) {
      console.error("Add participant failed:", err);
      alert("Failed to add participant to conference");
    }
  };

  const sendDigit = (d: string) => {
    sendDTMF(d);
  };

  const toggleRecord = async () => {
    if (!activeCall) return;
    try {
      if (!recording) {
        await startRecording();
      } else {
        await stopRecording();
      }
      setRecording(!recording);
    } catch (err) {
      console.error("Recording toggle failed:", err);
    }
  };

  const hangup = () => {
    try {
      console.log("📞 Hanging up call from modal");
      
      // Just call disconnectCall - it will handle the hangup safely
      disconnectCall();
      
      // Reset states immediately
      setMuted(false);
      setHeld(false);
      setRecording(false);
      setSeconds(0);
      setShowTransfer(false);
      setShowAddParticipant(false);
      setInConference(false);
      onOpenChange(false);
    } catch (err) {
      console.error("Hangup failed:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-80">
        <DialogHeader>
          <DialogTitle>On call with {number}</DialogTitle>
        </DialogHeader>
        <div className="text-center mb-4">{seconds}s</div>
        <div className="flex gap-2 mb-4 justify-center flex-wrap">
          <Button 
            size="sm" 
            variant={muted ? "destructive" : "outline"}
            onClick={handleMute}
          >
            {muted ? "🔇 Unmute" : "🔊 Mute"}
          </Button>
          <Button 
            size="sm" 
            variant={held ? "secondary" : "outline"}
            onClick={handleHold}
          >
            {held ? "▶️ Resume" : "⏸️ Hold"}
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => alert("Calls are automatically recorded. Check call history for recordings.")}
            title="Recording is automatic"
          >
            🔴 Recording
          </Button>
        </div>
        
        <div className="flex gap-2 mb-4 justify-center flex-wrap">
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => setShowTransfer(!showTransfer)}
          >
            🔀 Transfer
          </Button>
          {!inConference ? (
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleJoinConference}
            >
              👥 Conference
            </Button>
          ) : (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setShowAddParticipant(!showAddParticipant)}
            >
              ➕ Add Participant
            </Button>
          )}
        </div>
        
        {showTransfer && (
          <div className="mb-4 p-3 border rounded">
            <Label className="text-sm">Transfer to number:</Label>
            <div className="flex gap-2 mt-2">
              <Input
                type="tel"
                placeholder="+1234567890"
                value={transferNumber}
                onChange={(e) => setTransferNumber(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleTransfer()}
              />
              <Button size="sm" onClick={handleTransfer}>Transfer</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowTransfer(false)}>Cancel</Button>
            </div>
          </div>
        )}
        
        {showAddParticipant && (
          <div className="mb-4 p-3 border rounded">
            <Label className="text-sm">Add participant number:</Label>
            <div className="flex gap-2 mt-2">
              <Input
                type="tel"
                placeholder="+1234567890"
                value={participantNumber}
                onChange={(e) => setParticipantNumber(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddParticipant()}
              />
              <Button size="sm" onClick={handleAddParticipant}>Add</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddParticipant(false)}>Cancel</Button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {['1','2','3','4','5','6','7','8','9','*','0','#'].map(d => (
            <Button key={d} size="sm" variant="outline" onClick={() => sendDigit(d)}>
              {d}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="destructive" onClick={hangup} className="w-full">
            Hang Up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
