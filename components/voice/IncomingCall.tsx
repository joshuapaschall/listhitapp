"use client";

import { useEffect, useRef, useState } from "react";
import { TelnyxRTC, Call } from "@telnyx/webrtc";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff } from "lucide-react";
import CallModal from "./CallModal";

interface Props {
  device: TelnyxRTC | null;
  activeCall: Call | null;
  pendingConference: any;
  onAccept: (conferenceId: string) => void;
  onDecline: (conferenceId: string) => void;
}

export default function IncomingCall({ device, activeCall }: Props) {
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const [showCallModal, setShowCallModal] = useState(false);

  // Handle both inbound and outbound calls - show interface for any ringing call
  const isIncomingCall = activeCall && 
                        activeCall.state === "ringing" && 
                        (!activeCall.direction || activeCall.direction === "inbound");
                        
  const isOutboundCall = activeCall && 
                        activeCall.state === "ringing" && 
                        activeCall.direction === "outbound";
                        
  const showCallInterface = isIncomingCall || isOutboundCall;
  
  // Handle ringtone playing (only for incoming calls)
  useEffect(() => {
    if (isIncomingCall) {
      // Create and play ringtone for incoming calls
      const ringtone = new Audio('/sounds/mixkit-on-hold-ringtone-1361.wav');
      ringtone.loop = true;
      ringtone.volume = 0.8; // Set volume to 80%
      
      ringtone.play().catch(err => {
        console.warn("Ringtone play failed:", err);
      });
      
      ringtoneRef.current = ringtone;
      console.log("🔔 Playing incoming call ringtone");
    } else {
      // Stop ringtone when call ends or is answered
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
        ringtoneRef.current = null;
        console.log("🔕 Stopped ringtone");
      }
    }
    
    // Cleanup on unmount
    return () => {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current = null;
      }
    };
  }, [isIncomingCall]);
  
  // Show call modal when call is active (answered)
  useEffect(() => {
    if (activeCall && activeCall.state === "active" && !showCallModal) {
      setShowCallModal(true);
    } else if (!activeCall && showCallModal) {
      setShowCallModal(false);
    }
  }, [activeCall, showCallModal]);
  
  if (showCallInterface) {
    const handleAccept = async () => {
      if (isIncomingCall) {
        console.log("✅ Accepting incoming call");
        // Stop ringtone immediately
        if (ringtoneRef.current) {
          ringtoneRef.current.pause();
          ringtoneRef.current = null;
        }
        
        try {
          // Ensure microphone permissions before answering
          console.log("🎤 Checking microphone permissions before answering...");
          try {
            const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log("✅ Microphone permissions confirmed");
            // Stop the test stream
            testStream.getTracks().forEach(track => track.stop());
          } catch (err) {
            console.error("❌ Failed to get microphone access:", err);
            alert("Microphone access is required to answer calls. Please grant permission and try again.");
            return;
          }
          
          // Enable device microphone
          if (device) {
            console.log("🎤 Enabling device microphone...");
            device.enableMicrophone();
          }
          
          // Answer the call
          await activeCall.answer();
          console.log("📞 Call answered successfully");
          
          // Immediately unmute after answering
          if (activeCall.unmuteAudio) {
            console.log("🔊 Unmuting answered call");
            activeCall.unmuteAudio();
          }
          
          // Log call state after answering
          console.log("📞 Call state after answer:", activeCall.state);
          console.log("🎤 Local stream:", activeCall.localStream ? "Available" : "Not available");
          console.log("🔊 Remote stream:", activeCall.remoteStream ? "Available" : "Not available");
          
          // Manually handle remote audio for incoming calls
          const setupIncomingCallAudio = () => {
            if (activeCall.remoteStream) {
              console.log("🔊 Setting up remote audio for incoming call");
              
              // Remove any existing audio element
              const existingAudio = document.getElementById('telnyx-remote-audio');
              if (existingAudio) {
                existingAudio.remove();
              }
              
              // Create new audio element
              const remoteAudio = document.createElement('audio');
              remoteAudio.id = 'telnyx-remote-audio';
              remoteAudio.autoplay = true;
              remoteAudio.volume = 1.0;
              
              // Add event listeners
              remoteAudio.addEventListener('playing', () => {
                console.log("🔊 Incoming call audio is playing");
              });
              
              // Attach stream and play
              remoteAudio.srcObject = activeCall.remoteStream;
              document.body.appendChild(remoteAudio);
              
              remoteAudio.play()
                .then(() => console.log("🔊 Incoming call audio started"))
                .catch(err => console.warn("🔊 Incoming call audio play failed:", err));
            } else {
              console.log("🔊 No remote stream yet, will retry...");
              setTimeout(setupIncomingCallAudio, 500);
            }
          };
          
          // Set up audio immediately and after a delay
          setupIncomingCallAudio();
          setTimeout(setupIncomingCallAudio, 1000)
          
          // Log stream status
          console.log("🎤 Local stream:", activeCall.localStream ? "Available" : "Not available");
          console.log("🔊 Remote stream:", activeCall.remoteStream ? "Available" : "Not available");
          
          // Ensure remote audio element exists and is attached
          if (activeCall.remoteStream) {
            let remoteAudio = document.getElementById('telnyx-remote-audio') as HTMLAudioElement;
            if (!remoteAudio) {
              remoteAudio = document.createElement('audio');
              remoteAudio.id = 'telnyx-remote-audio';
              remoteAudio.autoplay = true;
              document.body.appendChild(remoteAudio);
              console.log("🎵 Created remote audio element on answer");
            }
            
            remoteAudio.srcObject = activeCall.remoteStream;
            await remoteAudio.play().catch(err => {
              console.warn("Remote audio play failed:", err);
            });
            
            console.log("🔊 Remote audio stream attached and playing");
          }
          
          // Create call record
          const callData = activeCall as any;
          const to = callData.destinationNumber || callData.localIdentity || 'Unknown';
          const from = callData.remoteCallerNumber || callData.remoteIdentity || 'Unknown';
          
          const response = await fetch('/api/calls/record', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to,
              callerId: from,
              direction: 'inbound',
              answered: true,
              webrtc: true
            }),
          });
          
          if (response.ok) {
            const { id } = await response.json();
            // Store the call ID on the call object for later use
            (activeCall as any)._callId = id;
            console.log('✅ Call record created:', id);
          }
          
        } catch (err) {
          console.error("❌ Failed to answer call:", err);
        }
      } else if (isOutboundCall) {
        console.log("✅ Call connecting...");
        // For outbound calls, this doesn't really "accept" but could show connecting state
        // The call will automatically progress when the other party answers
      }
    }
    
    const handleDecline = () => {
      if (isIncomingCall) {
        console.log("❌ Declining incoming call");
      } else if (isOutboundCall) {
        console.log("❌ Hanging up outbound call");
      }
      
      // Stop ringtone immediately
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current = null;
      }
      activeCall.hangup();
    }

    // Determine the display text and button labels
    const getCallInfo = () => {
      if (isIncomingCall) {
        // Try multiple fields to get the caller number
        const callerNumber = (activeCall as any).remoteCallerNumber || 
                           (activeCall as any).remoteIdentity || 
                           (activeCall as any).from ||
                           (activeCall as any).remoteNumber ||
                           (activeCall as any).callerIdNumber ||
                           (activeCall as any).params?.From ||
                           (activeCall as any).params?.from ||
                           "Unknown Number";
        
        return {
          title: "Incoming Call",
          subtitle: callerNumber,
          acceptLabel: "Accept",
          declineLabel: "Decline"
        };
      } else {
        const destinationNumber = (activeCall as any).destinationNumber || 
                                (activeCall as any).params?.To ||
                                (activeCall as any).params?.to ||
                                "Unknown";
        return {
          title: "Calling...",
          subtitle: destinationNumber,
          acceptLabel: "Connecting",
          declineLabel: "Hang Up"
        };
      }
    };

    const callInfo = getCallInfo();

    return (
      <>
        <div className="fixed bottom-24 right-6 z-[100] animate-pulse">
          <div className="bg-card border border-border rounded-lg shadow-2xl p-6 w-80">
            <div className="text-center">
              <div className="relative inline-flex mb-4">
                <div className="absolute inset-0 bg-green-500 rounded-full animate-ping" />
                <Phone className="h-12 w-12 text-green-500 relative z-10" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{callInfo.title}</h3>
              <p className="text-muted-foreground mb-6">
                {callInfo.subtitle}
              </p>
              <div className="flex gap-3 justify-center">
                {isIncomingCall && (
                  <Button
                    onClick={handleAccept}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    size="lg"
                  >
                    <Phone className="h-5 w-5 mr-2" />
                    {callInfo.acceptLabel}
                  </Button>
                )}
                <Button
                  onClick={handleDecline}
                  variant="destructive"
                  size="lg"
                >
                  <PhoneOff className="h-5 w-5 mr-2" />
                  {callInfo.declineLabel}
                </Button>
              </div>
            </div>
          </div>
        </div>
        {showCallModal && (
          <CallModal 
            open={showCallModal} 
            onOpenChange={setShowCallModal}
          />
        )}
      </>
    );
  }
  
  // Show call modal if call is active
  if (activeCall && activeCall.state === "active" && showCallModal) {
    return (
      <CallModal 
        open={showCallModal} 
        onOpenChange={setShowCallModal}
      />
    );
  }
  
  return null;
}
