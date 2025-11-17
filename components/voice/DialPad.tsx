"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import BuyerSelector from "@/components/buyers/buyer-selector";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useTelnyxDevice } from "./TelnyxDeviceProvider";
import CallModal from "./CallModal";
import { formatPhoneE164 } from "@/lib/dedup-utils";
import { CallValidationService } from "@/lib/call-validation";

export default function DialPad({ buyerId }: { buyerId?: string }) {
  const { connectCall, status } = useTelnyxDevice();
  const [buyer, setBuyer] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [numbers, setNumbers] = useState<string[]>([]);
  const [callerId, setCallerId] = useState("");
  const [callRecordData, setCallRecordData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/voice-numbers")
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.numbers)) {
          setNumbers(d.numbers);
          if (!callerId && d.numbers.length > 0) setCallerId(d.numbers[0]);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for call connection and error events
  useEffect(() => {
    const handleCallConnected = (event: CustomEvent) => {
      if (callRecordData) {
        console.log("📝 Call connected, creating call record");
        fetch("/api/calls/record", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(callRecordData),
        }).catch(err => console.warn("Failed to save call record:", err));
        setCallRecordData(null); // Clear after recording
      }
    };

    const handleCallError = (event: CustomEvent) => {
      const { message } = event.detail;
      console.error("Call error received:", message);
      
      // Clear any pending call record data
      setCallRecordData(null);
      setLoading(false);
      
      // Show user-friendly error message
      toast.error(message || "Call failed to connect");
    };

    const handleCallFailed = (event: CustomEvent) => {
      const { reason } = event.detail;
      console.log("Call failed:", reason);
      
      // Clear any pending call record data
      setCallRecordData(null);
      setLoading(false);
      
      // Show user feedback for failed calls
      toast.error(reason || "Call was not answered");
    };

    window.addEventListener('telnyxCallConnected', handleCallConnected as EventListener);
    window.addEventListener('telnyxCallError', handleCallError as EventListener);
    window.addEventListener('telnyxCallFailed', handleCallFailed as EventListener);
    
    return () => {
      window.removeEventListener('telnyxCallConnected', handleCallConnected as EventListener);
      window.removeEventListener('telnyxCallError', handleCallError as EventListener);
      window.removeEventListener('telnyxCallFailed', handleCallFailed as EventListener);
    };
  }, [callRecordData]);

  // ────────────────────────────────────────────────────────────────────────────
  async function dial() {
    const to = buyer?.phone;
    if (!to) {
      toast.error("No phone number available for this buyer");
      return;
    }

    if (!callerId) {
      toast.error("Please select a caller ID");
      return;
    }

    try {
      setLoading(true);
      const formatted = formatPhoneE164(to) || to;
      
      console.log("🔍 Validating call to:", formatted);
      
      // Validate call before proceeding
      const validation = await CallValidationService.validateCall(
        formatted, 
        buyer?.id || buyerId
      );

      console.log("📋 Validation result:", validation);

      // Handle validation results
      if (!validation.allowed) {
        const blockerMessage = validation.blockers.join(", ");
        toast.error(`Call blocked: ${blockerMessage}`);
        setLoading(false);
        return;
      }

      // Show warnings if any (but still allow call)
      if (validation.warnings.length > 0) {
        validation.warnings.forEach(warning => {
          toast.warning(warning);
        });
      }

      console.log("✅ Call validation passed, proceeding...");
      console.log("Dialing:", formatted);
      
      // Store call record data to create AFTER connection
      if (buyer?.id || buyerId) {
        setCallRecordData({
          buyerId: buyer?.id || buyerId, 
          to: formatted,
          callerId: callerId,
          webrtc: true,
          direction: "outbound",
          validationResult: validation
        });
      }

      // Make the WebRTC call directly with caller ID
      await connectCall(formatted, callerId);
      setShowModal(true);
      
    } catch (err: any) {
      console.error("Call failed:", err);
      toast.error(err.message || "Call failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <BuyerSelector value={buyer} onChange={setBuyer} placeholder="Search buyers" />
      <Select value={callerId} onValueChange={setCallerId}>
        <SelectTrigger className="h-8 w-32">
          <SelectValue placeholder="Caller ID" />
        </SelectTrigger>
        <SelectContent>
          {numbers.map(n => (
            <SelectItem key={n} value={n} className="cursor-pointer">
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button onClick={dial} disabled={loading}>
        {loading ? "Calling..." : "Call"}
      </Button>
      <CallModal open={showModal} onOpenChange={setShowModal} />
    </div>
  );
}
