/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
} from "react";
import {
  TelnyxRTC,
  Call,
  SwEvent,
} from "@telnyx/webrtc";
import IncomingCall from "@/components/voice/IncomingCall";
import { supabaseBrowser } from "@/lib/supabase-browser";

export interface TelnyxContextValue {
  device: TelnyxRTC | null;
  activeCall: Call | null;
  status: "idle" | "connecting" | "on-call" | "error";
  connectCall: (number: string, callerIdNumber?: string) => Promise<void>;
  disconnectCall: () => void;
  toggleMute: () => void;
  unmute: () => void;
  toggleHold: () => Promise<void>;
  unhold: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  transfer: (number: string) => Promise<void>;
  sendDTMF: (digits: string) => void;
  // Conference methods
  joinConference: (conferenceId?: string) => Promise<void>;
  leaveConference: () => Promise<void>;
  addToConference: (phoneNumber: string) => Promise<void>;
}

const TelnyxContext = createContext<TelnyxContextValue | undefined>(undefined);

export function useTelnyx(): TelnyxContextValue {
  const ctx = useContext(TelnyxContext);
  if (!ctx) throw new Error("useTelnyx must be used inside TelnyxDeviceProvider");
  return ctx;
}

export const useTelnyxDevice = useTelnyx;

function TelnyxDeviceProvider({ children }: { children: ReactNode }) {
  const [device, setDevice] = useState<TelnyxRTC | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [status, setStatus] = useState<TelnyxContextValue["status"]>("connecting");
  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [sipUsername, setSipUsername] = useState<string | null>(null);

  const activeCallRef = useRef(activeCall);
  const holdMusicRef = useRef<HTMLAudioElement | null>(null);
  const playbackIdRef = useRef<string | null>(null);
  const clientIdRef = useRef<string | null>(null);
  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);

  if (!clientIdRef.current) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      clientIdRef.current = crypto.randomUUID();
    } else {
      clientIdRef.current = Math.random().toString(36).slice(2);
    }
  }

  const upsertPresence = async (presenceStatus: "online" | "offline") => {
    if (!sipUsername || !clientIdRef.current) return;

    try {
      await fetch("/api/agents/presence", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: presenceStatus,
          client_id: clientIdRef.current,
          sip_username: sipUsername,
        }),
      });
    } catch (error) {
      console.warn("Failed to update agent presence", error);
    }
  };

  useEffect(() => {
    if (!sipUsername || !clientIdRef.current) return;

    void upsertPresence("online");
    const interval = window.setInterval(() => {
      void upsertPresence("online");
    }, 25_000);

    const handleBeforeUnload = () => {
      void upsertPresence("offline");
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      void upsertPresence("offline");
    };
  }, [sipUsername]);
  

  // Check browser compatibility
  const checkBrowserSupport = () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("WebRTC not supported in this browser");
    }
    return true;
  };
  
  // Request microphone permissions early
  const requestAudioPermissions = async () => {
    try {
      console.log("🎤 Requesting microphone permissions...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("✅ Microphone permissions granted");
      // Stop the stream immediately - we just wanted permissions
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error("❌ Failed to get microphone permissions:", err);
    }
  };

  useEffect(() => {
    let created: TelnyxRTC | null = null;
    let isMounted = true;
    
    console.log("🚀 TelnyxDeviceProvider effect starting");


    const onReady = async () => {
      if (!isMounted) return;
      console.log("[telnyx] ready");
      console.log("🟢 Telnyx ready - can make calls");
      setIsReady(true);
      setStatus("idle");
      
      // Enable microphone when ready and check permissions
      if (created) {
        console.log("🎤 Checking microphone permissions on ready...");
        
        // Try to get microphone permissions proactively
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log("✅ Microphone permissions confirmed");
          const tracks = stream.getAudioTracks();
          console.log("🎤 Available audio tracks:", tracks.length);
          tracks.forEach(track => {
            console.log(`  - ${track.label}: ${track.readyState}`);
          });
          // Stop the test stream
          stream.getTracks().forEach(track => track.stop());
        } catch (err) {
          console.error("❌ Microphone permission check failed:", err);
        }
        
        created.enableMicrophone();
        
        console.log("📋 WebRTC connection details:");
        console.log("  - Session ID:", created.sessionid);
        console.log("  - Auth type:", (created as any).options?.login ? "Username/Password" : "JWT");
        console.log("  - Username:", (created as any).options?.login || "N/A");
        console.log("  - Connection state:", (created as any).connectionState || "unknown");
        
        // Check if microphone is actually enabled
        console.log("  - Microphone enabled:", (created as any).microphoneEnabled || "unknown");
      }
    };

    const onError = (e: any) => {
      if (!isMounted) return;
      // Ignore SDP-related errors as they're internal SDK issues
      if (e && e.message && e.message.includes('sdp')) {
        console.warn("⚠️ Ignoring SDP error:", e.message);
        return;
      }
      console.error("[telnyx] error", e);
      console.error("TelnyxRTC Error:", e);
      setStatus("error");
    };

    const onNotification = (n: any) => {
      if (!isMounted) return;
      console.log("[telnyx] notif", n?.type);
      console.log("📞 Telnyx notification:", n.type);
      // Don't stringify the full event - it may have circular references
      
      // Handle incoming call notifications
      if (n.type === "call.received" && n.call) {
        const call = n.call as Call;
        console.log("📱 INCOMING CALL RECEIVED!");
        
        // Log all call properties to find the correct phone number field
        console.log("📱 Call object properties:", {
          remoteCallerNumber: (call as any).remoteCallerNumber,
          remoteIdentity: (call as any).remoteIdentity,
          from: (call as any).from,
          remoteNumber: (call as any).remoteNumber,
          callerIdNumber: (call as any).callerIdNumber,
          callerIdName: (call as any).callerIdName,
          remoteSdp: !!(call as any).remoteSdp,
          options: (call as any).options,
          params: (call as any).params,
          headers: (call as any).headers
        });
        
        // Try multiple fields to get the caller number
        const callerNumber = (call as any).remoteCallerNumber || 
                           (call as any).remoteIdentity || 
                           (call as any).from ||
                           (call as any).remoteNumber ||
                           (call as any).callerIdNumber ||
                           "Unknown";
        
        console.log("📱 Call from:", callerNumber);
        
        if (isMounted) {
          setActiveCall(call);
          setStatus("connecting");
        }
      }
      
      if (n.type === "callUpdate" && n.call) {
        const call = n.call as Call;
        console.log("📞 Call state:", call.state, "direction:", call.direction);
        
        // Handle inbound calls - simplified detection
        if (call.state === "ringing") {
          // Check if this is an incoming call without modifying the call object
          const isIncoming = !call.direction || call.direction === "inbound" || 
                           (call.state === "ringing" && !activeCallRef.current);
          
          if (isIncoming) {
            // Try multiple fields to get the caller number
            const callerNumber = (call as any).remoteCallerNumber || 
                               (call as any).remoteIdentity || 
                               (call as any).from ||
                               (call as any).remoteNumber ||
                               (call as any).callerIdNumber ||
                               "Unknown";
            console.log("📱 INCOMING CALL from:", callerNumber);
            if (isMounted) {
              setActiveCall(call);
              setStatus("connecting");
            }
          }
        }
        
        // Handle call state changes
        switch(call.state) {
          case "active":
            console.log("✅ Call is now active - audio should be handled by SDK");
            
            // Log call properties to see what's available for conference/transfer
            console.log("📞 Active call properties:", {
              telnyxIDs: (call as any).telnyxIDs,
              telnyxCallControlId: (call as any).telnyxIDs?.telnyxCallControlId,
              telnyxSessionId: (call as any).telnyxIDs?.telnyxSessionId,
              telnyxLegId: (call as any).telnyxIDs?.telnyxLegId,
              id: (call as any).id,
              callId: (call as any).callId,
              sessionId: (call as any).sessionId,
              sipCallId: (call as any).sipCallId,
              peer: (call as any).peer,
              direction: call.direction,
              state: call.state
            });
            
            // Ensure audio is properly set up for active call
            console.log("🎤 Call is now ACTIVE - setting up audio");
            
            // Enable microphone at device level
            if (created) {
              created.enableMicrophone();
            }
            
            // Unmute the call explicitly
            if (call.unmuteAudio) {
              console.log("🔊 Unmuting call audio");
              call.unmuteAudio();
            }
            
            // Check if we have local stream
            if (call.localStream) {
              console.log("🎤 Local stream is available");
              const audioTracks = call.localStream.getAudioTracks();
              console.log("🎤 Number of audio tracks:", audioTracks.length);
              
              audioTracks.forEach((track, index) => {
                console.log(`🎤 Audio track ${index}:`);
                console.log(`  - Label: ${track.label}`);
                console.log(`  - Enabled: ${track.enabled}`);
                console.log(`  - Muted: ${track.muted}`);
                console.log(`  - ReadyState: ${track.readyState}`);
                
                // Force enable the track
                if (!track.enabled) {
                  console.log(`  - Enabling track ${index}`);
                  track.enabled = true;
                }
              });
              
              // Double-check microphone is not muted at any level
              if ((call as any).microphoneMuted === true) {
                console.log("🎤 Call microphone is muted, unmuting...");
                if ((call as any).unmuteMicrophone) {
                  (call as any).unmuteMicrophone();
                }
              }
            } else {
              console.warn("⚠️ No local stream available yet in active state");
            }
            
            // Force unmute everything when call becomes active
            setTimeout(() => {
              console.log("🎤 Running force unmute after call active");
              forceUnmuteAll();
            }, 1000);
            
            // Manually handle remote audio playback
            const setupRemoteAudio = () => {
              console.log("🔊 Setting up remote audio manually");
              
              // Remove any existing audio element
              const existingAudio = document.getElementById('telnyx-remote-audio');
              if (existingAudio) {
                existingAudio.remove();
                console.log("🧹 Removed existing audio element");
              }
              
              if (call.remoteStream) {
                console.log("🔊 Remote stream available with tracks:", {
                  audio: call.remoteStream.getAudioTracks().length,
                  video: call.remoteStream.getVideoTracks().length
                });
                
                // Create new audio element
                const remoteAudio = document.createElement('audio');
                remoteAudio.id = 'telnyx-remote-audio';
                remoteAudio.autoplay = true;
                remoteAudio.controls = false; // Hide controls
                remoteAudio.volume = 1.0; // Full volume
                
                // Add event listeners for debugging
                remoteAudio.addEventListener('loadedmetadata', () => {
                  console.log("🔊 Remote audio metadata loaded");
                });
                
                remoteAudio.addEventListener('playing', () => {
                  console.log("🔊 Remote audio is playing");
                });
                
                remoteAudio.addEventListener('error', (e) => {
                  console.error("🔊 Remote audio error:", e);
                });
                
                // Attach the stream
                remoteAudio.srcObject = call.remoteStream;
                document.body.appendChild(remoteAudio);
                
                // Force play
                remoteAudio.play()
                  .then(() => {
                    console.log("🔊 Remote audio playback started successfully");
                    
                    // Log audio track details
                    const audioTracks = call.remoteStream.getAudioTracks();
                    audioTracks.forEach((track, idx) => {
                      console.log(`🔊 Remote audio track ${idx}:`, {
                        label: track.label,
                        enabled: track.enabled,
                        muted: track.muted,
                        readyState: track.readyState
                      });
                    });
                  })
                  .catch(err => {
                    console.error("🔊 Remote audio play failed:", err);
                    // Try to play again with user interaction
                    console.log("🔊 Will retry on next user interaction");
                  });
              } else {
                console.warn("⚠️ No remote stream available yet");
                // Retry after a delay
                setTimeout(() => {
                  if (call.remoteStream && call.state === "active") {
                    console.log("🔊 Retrying remote audio setup");
                    setupRemoteAudio();
                  }
                }, 500);
              }
            };
            
            // Set up remote audio immediately
            setupRemoteAudio();
            
            // Also set up after a short delay in case stream arrives late
            setTimeout(setupRemoteAudio, 1000);
            
            if (isMounted) {
              setStatus("on-call");
              setActiveCall(call);
              
              // Create call record for all calls
              const callData = call as any;
              if (!callData._callRecordCreated) {
                console.log("📝 Creating call record");
                
                // Extract phone numbers
                const to = call.direction === "outbound" 
                  ? (callData.destinationNumber || callData.params?.To || "unknown")
                  : (callData.destinationNumber || callData.localIdentity || "unknown");
                  
                const from = call.direction === "outbound"
                  ? (callData.callerNumber || callData.localIdentity || "unknown")  
                  : (callData.remoteCallerNumber || callData.remoteIdentity || callData.from || "unknown");
                
                // Store any IDs we can find for recording matching
                const telnyxIds = {
                  sessionId: callData.sessionId || callData.id,
                  callId: callData.callId,
                  sipCallId: callData.sipCallId,
                  telnyxCallControlId: callData.telnyxIDs?.telnyxCallControlId,
                  telnyxSessionId: callData.telnyxIDs?.telnyxSessionId
                };
                
                fetch("/api/calls/record", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    to,
                    from,
                    callerId: from,
                    direction: call.direction || "unknown",
                    webrtc: true,
                    answered: true,
                    ...telnyxIds
                  }),
                })
                .then(res => res.json())
                .then(data => {
                  if (data.id) {
                    callData._callRecordId = data.id;
                    console.log("✅ Call record created:", data.id);
                  }
                })
                .catch(err => console.warn("Failed to save call record:", err));
                
                callData._callRecordCreated = true;
              }
            }
            break;
          case "hangup":
          case "destroy": 
          case "done":
            console.log("🔚 Call ended");
            if (isMounted) {
              setStatus("idle");
              setActiveCall(null);
              activeCallRef.current = null;
              
              // Stop hold music if playing
              if (holdMusicRef.current) {
                holdMusicRef.current.pause();
                holdMusicRef.current.currentTime = 0;
                console.log("🔕 Stopped hold music on call end");
              }
              
              // Clear playback ID
              if (playbackIdRef.current) {
                playbackIdRef.current = null;
              }
              
              // Clean up remote audio element
              const remoteAudio = document.getElementById('telnyx-remote-audio') as HTMLAudioElement;
              if (remoteAudio) {
                remoteAudio.pause();
                remoteAudio.srcObject = null;
                remoteAudio.remove();
                console.log("🧹 Cleaned up remote audio element");
              }
            }
            break;
        }
      }
    };

    (async () => {
      let tokenResp: any = null;
      try {
        // Prevent double initialization
        if (isInitializing) {
          console.log("⚠️ Telnyx initialization already in progress, skipping");
          return;
        }
        
        // Check if there's already a global device and clean it up
        if ((window as any).__telnyxGlobalDevice) {
          console.log("🧹 Cleaning up existing Telnyx device");
          try {
            const existingDevice = (window as any).__telnyxGlobalDevice;
            existingDevice.disconnect?.();
            (window as any).__telnyxGlobalDevice = null;
          } catch (err) {
            console.warn("Error cleaning up existing device:", err);
          }
          // Wait a moment for cleanup
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        setIsInitializing(true);
        
        // Check browser support first
        checkBrowserSupport();
        
        // Request audio permissions early
        await requestAudioPermissions();
        
        console.log("🔄 Fetching Telnyx token...");
        const supabase = supabaseBrowser();
        const {
          data: { session }
        } = await supabase.auth.getSession();
        const accessToken = session?.access_token;

        if (!accessToken) {
          console.warn("[Telnyx] No Supabase session; user must sign in.");
          if (isMounted) {
            setStatus("idle");
            setIsInitializing(false);
          }
          return;
        }

        const res = await fetch("/api/telnyx/token", {
          method: "POST",
          credentials: "include",
          headers: accessToken
            ? {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`
              }
            : {
                "Content-Type": "application/json"
              },
          body: JSON.stringify({}),
          cache: "no-store"
        });
        try {
          tokenResp = await res.json();
        } catch {
          throw new Error("Invalid JSON response from Telnyx token API");
        }

        console.log("📡 Auth response:", {
          ok: res.ok,
          status: res.status,
          hasToken: !!tokenResp.token,
          sipUsername: tokenResp.sip_username,
          error: tokenResp.error
        });

        if (!res.ok) {
          throw new Error(tokenResp?.error || "Failed to fetch Telnyx token");
        }

        if (!tokenResp?.sip_username) {
          console.error("No SIP username for this agent.");
          toast.error("No SIP username configured for this agent.");
          if (isMounted) {
            setStatus("error");
            setIsInitializing(false);
          }
          return;
        }

        if (!tokenResp?.token) {
          throw new Error(tokenResp?.error || "Failed to fetch Telnyx token");
        }

        // Use JWT authentication
        console.log("🔧 Creating TelnyxRTC with login token");
        console.log("📝 SIP username for routing:", tokenResp.sip_username);
        console.log("🔐 Using token authentication");

        created = new TelnyxRTC({
          login_token: tokenResp.token,
          // Enable debug to see what's happening with audio
          debug: true
        });
        
        // Store SIP username for display/debugging
        if (tokenResp.sip_username) {
          localStorage.setItem("telnyx_sip_username", tokenResp.sip_username);
        }

        if (isMounted) {
          setSipUsername(tokenResp.sip_username || null);
        }
        
        if (!created) {
          throw new Error("Failed to create TelnyxRTC instance");
        }
        
        // Let SDK handle audio completely - no manual audio element
        console.log("🔊 Letting SDK handle audio internally");

        // No longer needed - remove debug timer

        // Use correct Telnyx event names
        created.on("telnyx.ready", onReady);
        created.on("telnyx.error", onError);
        created.on("telnyx.notification", onNotification);

        // Listen for incoming calls specifically
        created.on("telnyx.call.received", (call: Call) => {
          console.log("🔔 DIRECT INCOMING CALL EVENT!");
          console.log("🔔 Direction:", call.direction);
          console.log("🔔 State:", call.state);
          
          if (isMounted) {
            setActiveCall(call);
            setStatus("connecting");
          }
        });
        
        // Add event listeners for media and microphone status
        created.on('telnyx.media.element', (el: HTMLMediaElement) => {
          console.log("🎵 Media element created:", el);
        });
        
        created.on('telnyx.media.stream', (stream: MediaStream) => {
          console.log("📡 Media stream event:", stream);
          console.log("  - Audio tracks:", stream.getAudioTracks().length);
          console.log("  - Video tracks:", stream.getVideoTracks().length);
          stream.getAudioTracks().forEach(track => {
            console.log(`  - Audio track: ${track.label}, enabled: ${track.enabled}, muted: ${track.muted}`);
          });
        });
        
        created.on('telnyx.rtc.localstream', (stream: MediaStream) => {
          console.log("🎤 Local stream obtained:", stream);
          const audioTracks = stream.getAudioTracks();
          console.log("🎤 Local audio tracks:", audioTracks.length);
          audioTracks.forEach(track => {
            console.log(`  - ${track.label}: enabled=${track.enabled}, muted=${track.muted}, readyState=${track.readyState}`);
          });
        });
        
        // Listen for stream events
        created.on('telnyx.stream.received', (stream: MediaStream) => {
          console.log("📡 Remote stream received via stream event!");
          console.log("📡 Stream has audio tracks:", stream.getAudioTracks().length);
          
          // Manually handle the remote stream
          const handleRemoteStream = () => {
            // Remove any existing audio element
            const existingAudio = document.getElementById('telnyx-remote-audio');
            if (existingAudio) {
              existingAudio.remove();
            }
            
            // Create fresh audio element
            const remoteAudio = document.createElement('audio');
            remoteAudio.id = 'telnyx-remote-audio';
            remoteAudio.autoplay = true;
            remoteAudio.controls = false;
            remoteAudio.volume = 1.0;
            
            // Attach event listeners
            remoteAudio.addEventListener('canplay', () => {
              console.log("🔊 Remote audio can play");
              remoteAudio.play().catch(e => console.warn("🔊 Play failed:", e));
            });
            
            remoteAudio.addEventListener('playing', () => {
              console.log("🔊 Remote audio is now playing from stream event");
            });
            
            // Set the stream and append to body
            remoteAudio.srcObject = stream;
            document.body.appendChild(remoteAudio);
            
            // Try to play immediately
            remoteAudio.play()
              .then(() => console.log("🔊 Remote audio started from stream event"))
              .catch(err => {
                console.warn("🔊 Initial play failed, will play on user interaction:", err);
                // Add click handler to retry
                document.addEventListener('click', () => {
                  remoteAudio.play().catch(() => {});
                }, { once: true });
              });
          };
          
          handleRemoteStream();
        });
        
        // Add media permission check for incoming calls
        created.on('telnyx.media.permission', async () => {
          console.log("🎤 Media permission requested for incoming call");
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log("✅ Microphone permission granted for incoming call");
            // Stop tracks - we just needed permission
            stream.getTracks().forEach(track => track.stop());
          } catch (err) {
            console.error("❌ Failed to get microphone permission:", err);
          }
        });
        

        // For SIP registration, we need to wait for the connection
        // and then check registration status
        created.on('telnyx.socket.connect', () => {
          console.log("✅ WebSocket connected!");
        });
        
        created.on('telnyx.registered', () => {
          console.log("✅ SIP REGISTERED! You should see this in the dashboard now.");
        });
        
        created.on('telnyx.unregistered', () => {
          console.log("❌ SIP UNREGISTERED!");
        });
        
        created.on('telnyx.registration_failed', (error: any) => {
          console.error("❌ SIP Registration failed:", error);
        });
        
        // CRITICAL: Must connect the device before making calls
        console.log("🔌 Connecting to Telnyx...");
        await created.connect();
        
        // Ensure registration completes after connecting
        console.log("📝 Attempting SIP registration...");
        try {
          // Wait a moment for connection to stabilize
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Call register method if available
          if (typeof (created as any).register === 'function') {
            await (created as any).register();
            console.log("✅ Register method called");
          } else {
            console.log("ℹ️ No explicit register method, relying on auto-registration");
          }
        } catch (err) {
          console.warn("Registration failed:", err);
        }
        
        // Wait for the actual ready state - this is crucial!
        console.log("⏳ Waiting for telnyx.ready event...");
        

        if (isMounted) {
          setDevice(created);
          setIsInitializing(false);
          
          // Store globally to prevent double initialization
          (window as any).__telnyxGlobalDevice = created;
          
          // Expose to window for debugging
          (window as any).telnyxDevice = created;
        }
      } catch (err) {
        console.error("❌ Failed to initialize TelnyxRTC:", err);
        console.log("ℹ️ Navigator online status:", navigator.onLine);
        console.log("ℹ️ Last token response:", tokenResp);
        if (isMounted) {
          setSipUsername(null);
          setStatus("error");
          setIsInitializing(false);
        }
      }
    })();

    return () => {
      console.log("🧹 TelnyxDeviceProvider cleanup starting");
      isMounted = false;
      
      // Reset all state to initial values to prevent stale updates
      setDevice(null);
      setActiveCall(null);
      setStatus("connecting");
      setIsReady(false);
      setIsInitializing(false);
      setSipUsername(null);
      
      if (created) {
        console.log("🧹 Disconnecting Telnyx device");
        created.off('telnyx.ready', onReady);
        created.off('telnyx.error', onError);
        created.off('telnyx.notification', onNotification);
        created.off('telnyx.stream.received');
        created.off('telnyx.call.received');

        if (typeof created.disconnect === "function") {
          created.disconnect().catch(() => {});
        }
      }
      
      // Clean up hold music
      if (holdMusicRef.current) {
        holdMusicRef.current.pause();
        holdMusicRef.current = null;
        console.log("🧹 Cleaned up hold music");
      }
      
      // Clear global device reference only if this is the device we created
      if ((window as any).__telnyxGlobalDevice === created) {
        (window as any).__telnyxGlobalDevice = null;
      }
      
      // Cleanup complete
      
      console.log("🧹 TelnyxDeviceProvider cleanup complete");
    };
  }, []); // Empty dependency array

  const connectCall = async (number: string, callerIdNumber?: string) => {
    if (!device) {
      console.error("❌ Device not initialized");
      return;
    }
    
    // Check if device is ready and no call in progress
    if (!isReady || status !== "idle") {
      console.error("❌ Device not ready - isReady:", isReady, "status:", status);
      return;
    }
    
    // Prevent duplicate calls - check if we already have an active call
    if (activeCallRef.current) {
      console.warn("⚠️ Call already in progress, ignoring duplicate request. Current call state:", activeCallRef.current.state);
      return;
    }
    
    console.log("✅ No active call found, proceeding with new call");
    
    try {
      // Ensure microphone permissions and enable microphone
      console.log("🎤 Checking microphone permissions...");
      try {
        // Just check permissions, don't hold onto the stream
        const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("✅ Microphone permissions granted");
        // Stop the test stream
        testStream.getTracks().forEach(track => track.stop());
        
        // Enable device microphone
        device.enableMicrophone();
        console.log("🎤 Device microphone enabled");
        
      } catch (err) {
        console.error("❌ Failed to get microphone access:", err);
        throw new Error("Microphone access required for calls");
      }
      
      console.log("🔍 Device state check before call:");
      console.log("  - Device exists:", !!device);
      console.log("  - Status:", status);
      
      // Ensure phone number is in correct format
      const formattedNumber = number.startsWith('+') ? number : `+${number}`;
      
      // The Telnyx SDK handles getUserMedia internally
      // Just make the call with proper options
      const callOptions: any = { 
        destinationNumber: formattedNumber,
        video: false, // Explicitly disable video
        audio: true   // Enable audio
      };
      
      // Only add callerNumber if provided
      if (callerIdNumber) {
        callOptions.callerNumber = callerIdNumber.startsWith('+') ? callerIdNumber : `+${callerIdNumber}`;
        callOptions.callerName = 'DispoTool User';
      }
      
      console.log("📞 Initiating call to:", formattedNumber, "from:", callOptions.callerNumber || "default");
      
      const call = device.newCall(callOptions);
      
      // Debug the call object
      console.log("📞 Call object created:", {
        state: call.state,
        direction: call.direction,
        localStream: !!call.localStream,
        remoteStream: !!call.remoteStream,
        // Check various properties that might exist
        muted: (call as any).muted,
        microphoneMuted: (call as any).microphoneMuted,
        audioMuted: (call as any).audioMuted
      });
      
      // Try various methods to ensure microphone is not muted
      if (call.unmuteAudio) {
        console.log("🎤 Unmuting audio on call object");
        call.unmuteAudio();
      }
      
      if ((call as any).unmuteMicrophone) {
        console.log("🎤 Unmuting microphone on call object");
        (call as any).unmuteMicrophone();
      }
      
      // Check initial call state
      console.log("📞 Initial call state:", call.state);
      
      // Set active call IMMEDIATELY to prevent duplicate calls
      setActiveCall(call);
      activeCallRef.current = call; // Update ref synchronously
      setStatus("connecting");
      
      console.log("📞 Call created, calling invite()...");

      // According to docs, invite() should trigger SDP negotiation
      // and progress the call from 'new' to 'trying'
      try {
        call.invite();
      } catch (inviteErr: any) {
        console.error("❌ Call invite failed:", inviteErr);
        // Don't throw SDP errors - they're internal SDK issues
        if (inviteErr.message && inviteErr.message.includes('sdp')) {
          console.warn("⚠️ Ignoring SDP error - this is an internal SDK issue that doesn't affect call functionality");
          // Let the call proceed - the SDK will handle it internally
        } else {
          // For other errors, clean up and report
          try {
            call.hangup();
          } catch (hangErr) {
            console.warn("Error hanging up after failure:", hangErr);
          }
          setActiveCall(null);
          activeCallRef.current = null;
          setStatus("error");
          (window as any).dispatchEvent(new CustomEvent('telnyxCallError', {
            detail: {
              error: inviteErr,
              message: 'Call failed to connect. Please try again.'
            }
          }));
          return;
        }
      }
      
    } catch (err) {
      console.error("❌ Call failed:", err);
      setStatus("error");
      
      // Clear call state on error
      setActiveCall(null);
      activeCallRef.current = null;
      
      // Dispatch error event for UI feedback
      (window as any).dispatchEvent(new CustomEvent('telnyxCallError', { 
        detail: { 
          error: err,
          message: err instanceof Error ? err.message : 'Call failed to connect'
        } 
      }));
      
      throw err;
    }
  };

  const disconnectCall = () => {
    const currentCall = activeCallRef.current;
    
    // Only hangup if call is still active and not already hanging up
    if (currentCall && (currentCall.state === "active" || currentCall.state === "ringing" || currentCall.state === "trying" || currentCall.state === "early")) {
      try {
        console.log("🔚 Disconnecting call");
        currentCall.hangup();
      } catch (err) {
        console.warn("Error disconnecting call:", err);
      }
    }
    
    // Clear call state immediately for UI responsiveness
    setActiveCall(null);
    activeCallRef.current = null;
    setStatus("idle");
  };

  const toggleMute = () => {
    const currentCall = activeCallRef.current;
    if (!currentCall) return;
    console.log("🔇 Muting audio");
    // Use muteAudio() for muting
    currentCall.muteAudio();
  };

  const unmute = () => {
    const currentCall = activeCallRef.current;
    if (!currentCall) return;
    console.log("🔊 Unmuting");
    currentCall.unmuteAudio();
  };
  
  // Force unmute at all levels - for debugging microphone issues
  const forceUnmuteAll = () => {
    console.log("🎤 FORCE UNMUTE: Starting comprehensive unmute process");
    
    // 1. Device level
    if (device) {
      console.log("🎤 Enabling microphone at device level");
      device.enableMicrophone();
      
      // Check if there's a mute state on device
      if ((device as any).microphoneMuted === true) {
        console.log("🎤 Device microphone was muted, unmuting...");
        if ((device as any).unmuteMicrophone) {
          (device as any).unmuteMicrophone();
        }
      }
    }
    
    // 2. Call level
    const currentCall = activeCallRef.current;
    if (currentCall) {
      console.log("🎤 Unmuting at call level");
      
      // Try all possible unmute methods
      if (currentCall.unmuteAudio) {
        currentCall.unmuteAudio();
      }
      
      if ((currentCall as any).unmuteMicrophone) {
        (currentCall as any).unmuteMicrophone();
      }
      
      if ((currentCall as any).unmute) {
        (currentCall as any).unmute();
      }
      
      // 3. Stream level - check and enable all audio tracks
      if (currentCall.localStream) {
        const audioTracks = currentCall.localStream.getAudioTracks();
        console.log(`🎤 Checking ${audioTracks.length} audio tracks`);
        
        audioTracks.forEach((track, index) => {
          console.log(`🎤 Track ${index}: ${track.label}`);
          console.log(`   - Was enabled: ${track.enabled}`);
          console.log(`   - Was muted: ${track.muted}`);
          console.log(`   - ReadyState: ${track.readyState}`);
          
          // Force enable
          track.enabled = true;
          
          console.log(`   - Now enabled: ${track.enabled}`);
        });
      } else {
        console.warn("⚠️ No local stream found on call");
      }
      
      // Log current call state
      console.log("📞 Current call state:", {
        state: currentCall.state,
        direction: currentCall.direction,
        muted: (currentCall as any).muted,
        microphoneMuted: (currentCall as any).microphoneMuted,
        audioMuted: (currentCall as any).audioMuted
      });
    }
    
    console.log("🎤 FORCE UNMUTE: Complete");
  };

  const toggleHold = async () => {
    const currentCall = activeCallRef.current;
    if (!currentCall) return;
    
    // Try SDK hold first for WebRTC calls
    if (currentCall.hold) {
      try {
        console.log("⏸️ Using SDK hold");
        await currentCall.hold();
        console.log("✅ Call on hold via SDK");
        
        // Play hold music locally
        if (!holdMusicRef.current) {
          try {
            const holdMusic = new Audio('/sounds/hold-music.mp3');
            holdMusic.loop = true;
            holdMusic.volume = 0.3;
            await holdMusic.play();
            holdMusicRef.current = holdMusic;
            console.log("🎵 Playing local hold music");
          } catch (err) {
            console.warn("Failed to play local hold music:", err);
          }
        }
        return;
      } catch (err) {
        console.error("SDK hold failed:", err);
      }
    }
    
    // Fallback to Call Control API
    const callControlId = currentCall?.telnyxIDs?.telnyxCallControlId;
    if (!callControlId) {
      console.error("❌ No call control ID - cannot use Call Control API for hold");
      return;
    }
    
    try {
      console.log("⏸️ Putting call on hold");
      
      // Step 1: Put the call on hold (mutes the connection)
      const holdResponse = await fetch(`/api/calls/${callControlId}/hold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "hold" }),
      });
      
      if (!holdResponse.ok) {
        const error = await holdResponse.json();
        throw new Error(error.error || "Failed to hold call");
      }
      
      console.log("✅ Call on hold");
      
      // Step 2: Start playing hold music to the OTHER party
      // Option 1: Use environment variable for public URL (ngrok, production domain, etc)
      // Option 2: Use a direct CDN URL for the hold music
      const publicHoldMusicUrl = process.env.HOLD_MUSIC_URL || 
                                process.env.NEXT_PUBLIC_BASE_URL 
                                  ? `${process.env.NEXT_PUBLIC_BASE_URL}/sounds/hold-music.mp3`
                                  : `${window.location.origin}/sounds/hold-music.mp3`;
      
      const playbackResponse = await fetch(`/api/calls/${callControlId}/playback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "start",
          audio_url: publicHoldMusicUrl,
          loop: "infinity",
          target_legs: "opposite" // Play to the other party only
        }),
      });
      
      if (playbackResponse.ok) {
        const playbackData = await playbackResponse.json();
        playbackIdRef.current = playbackData.playback_id;
        console.log("🎵 Playing hold music to other party, playback ID:", playbackIdRef.current);
      } else {
        console.warn("Failed to start hold music playback");
      }
      
      // Step 3: Also play hold music locally for the agent (optional)
      if (!holdMusicRef.current) {
        try {
          const holdMusic = new Audio('/sounds/hold-music.mp3');
          holdMusic.loop = true;
          holdMusic.volume = 0.3; // Lower volume for local playback
          
          await new Promise((resolve, reject) => {
            holdMusic.addEventListener('canplay', resolve, { once: true });
            holdMusic.addEventListener('error', reject, { once: true });
            setTimeout(() => reject(new Error('Audio load timeout')), 3000);
          });
          
          holdMusicRef.current = holdMusic;
        } catch (err) {
          console.warn("Local hold music not available:", err);
        }
      }
      
      if (holdMusicRef.current) {
        holdMusicRef.current.play().catch(err => {
          console.warn("Local hold music play failed:", err);
        });
        console.log("🎵 Playing hold music locally");
      }
    } catch (err) {
      console.error("Hold failed:", err);
      // Fallback to SDK hold method
      try {
        await currentCall.hold();
      } catch (fallbackErr) {
        console.error("Fallback hold also failed:", fallbackErr);
      }
    }
  };

  const unhold = async () => {
    const currentCall = activeCallRef.current;
    if (!currentCall) return;
    
    // Stop local hold music first
    if (holdMusicRef.current) {
      holdMusicRef.current.pause();
      holdMusicRef.current.currentTime = 0;
      console.log("🔕 Stopped local hold music");
    }
    
    // Try SDK unhold first for WebRTC calls
    if (currentCall.unhold) {
      try {
        console.log("▶️ Using SDK unhold");
        await currentCall.unhold();
        console.log("✅ Call resumed via SDK");
        return;
      } catch (err) {
        console.error("SDK unhold failed:", err);
      }
    }
    
    // Fallback to Call Control API
    const callControlId = currentCall?.telnyxIDs?.telnyxCallControlId;
    if (!callControlId) {
      console.error("❌ No call control ID - cannot use Call Control API for unhold");
      return;
    }
    
    try {
      console.log("▶️ Resuming call");
      
      // Step 1: Stop the hold music playback to the other party
      if (playbackIdRef.current) {
        try {
          const stopPlaybackResponse = await fetch(`/api/calls/${callControlId}/playback`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "stop" }),
          });
          
          if (stopPlaybackResponse.ok) {
            console.log("🔕 Stopped hold music for other party");
          }
        } catch (err) {
          console.warn("Failed to stop playback:", err);
        }
        playbackIdRef.current = null;
      }
      
      // Step 2: Unhold the call
      const response = await fetch(`/api/calls/${callControlId}/hold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unhold" }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to unhold call");
      }
      
      console.log("✅ Call resumed");
      
      // Step 3: Stop local hold music
      if (holdMusicRef.current) {
        holdMusicRef.current.pause();
        holdMusicRef.current.currentTime = 0;
        console.log("🔕 Stopped local hold music");
      }
    } catch (err) {
      console.error("Unhold failed:", err);
      // Fallback to SDK unhold method
      try {
        await currentCall.unhold();
      } catch (fallbackErr) {
        console.error("Fallback unhold also failed:", fallbackErr);
      }
    }
  };

  const startRecording = async () => {
    // For WebRTC calls, recording happens at Telnyx server level
    console.log("🎙️ Call recording is automatic - check Telnyx dashboard for recordings");
    alert("Calls are automatically recorded. Recordings available in your Telnyx dashboard.");
  };

  const stopRecording = async () => {
    // Recording is automatic at server level
    console.log("🛑 Recording happens automatically at server level");
  };

  const transfer = async (number: string) => {
    const currentCall = activeCallRef.current;
    
    // For WebRTC/SIP calls, check if we have the SDK transfer method
    if (currentCall && (currentCall as any).transfer) {
      try {
        console.log("🔀 Using WebRTC SDK transfer to:", number);
        await (currentCall as any).transfer(number);
        console.log("✅ Call transferred via SDK");
        return;
      } catch (err) {
        console.error("❌ SDK transfer failed:", err);
      }
    }
    
    // Fallback to Call Control API if available
    const id = currentCall?.telnyxIDs?.telnyxCallControlId;
    if (!id) {
      console.error("❌ No call control ID available for transfer - WebRTC/SIP calls may not support Call Control API");
      alert("Transfer is not supported for WebRTC/SIP calls. You can manually call the number and hang up this call.");
      return;
    }
    
    try {
      const response = await fetch(`/api/calls/${id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: number }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to transfer call");
      }
      
      console.log("🔀 Call transferred successfully via API");
    } catch (err) {
      console.error("❌ Failed to transfer call:", err);
      throw err;
    }
  };

  const sendDTMF = (digits: string) => {
    const currentCall = activeCallRef.current;
    if (!currentCall) return;
    console.log("📞 Sending DTMF:", digits);
    currentCall.dtmf(digits);
  };
  
  // Conference functionality
  const joinConference = async (conferenceId?: string) => {
    const currentCall = activeCallRef.current;
    
    // Check if WebRTC SDK supports conference natively
    if (currentCall && (currentCall as any).joinConference) {
      try {
        console.log("🎯 Using WebRTC SDK conference");
        await (currentCall as any).joinConference(conferenceId);
        console.log("✅ Joined conference via SDK");
        return;
      } catch (err) {
        console.error("❌ SDK conference failed:", err);
      }
    }
    
    // Check for Call Control API support
    const callControlId = currentCall?.telnyxIDs?.telnyxCallControlId;
    
    if (!callControlId) {
      console.error("❌ No call control ID - WebRTC/SIP calls may not support conferences via Call Control API");
      alert("Conference calls are not supported for WebRTC/SIP connections. Consider using a conference bridge number instead.");
      return;
    }
    
    try {
      console.log("🎯 Joining conference via API:", conferenceId || "new");
      
      const response = await fetch("/api/calls/conference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callControlId,
          command: "join",
          conferenceId: conferenceId || `conf_${Date.now()}`,
          holdMusicUrl: "/sounds/hold-music.mp3", // Use the hold music for conference
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to join conference");
      }
      
      console.log("✅ Joined conference successfully");
      
      // Store conference ID for later use
      (currentCall as any).conferenceId = conferenceId || data.data?.conference_id;
      
    } catch (error) {
      console.error("❌ Conference join failed:", error);
      throw error;
    }
  };
  
  const leaveConference = async () => {
    const currentCall = activeCallRef.current;
    const callControlId = currentCall?.telnyxIDs?.telnyxCallControlId;
    
    if (!callControlId) {
      console.error("❌ No active call to leave conference");
      return;
    }
    
    try {
      console.log("👋 Leaving conference");
      
      const response = await fetch("/api/calls/conference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callControlId,
          command: "leave",
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to leave conference");
      }
      
      console.log("✅ Left conference successfully");
      
      // Clear conference ID
      (currentCall as any).conferenceId = null;
      
    } catch (error) {
      console.error("❌ Conference leave failed:", error);
      throw error;
    }
  };
  
  const addToConference = async (phoneNumber: string) => {
    const currentCall = activeCallRef.current;
    const conferenceId = (currentCall as any)?.conferenceId;
    
    if (!conferenceId) {
      console.error("❌ Not in a conference");
      return;
    }
    
    if (!device || !isReady) {
      console.error("❌ Device not ready");
      return;
    }
    
    try {
      console.log("➕ Adding participant to conference:", phoneNumber);
      
      // Create a new call to the participant
      const callOptions = { 
        destinationNumber: phoneNumber,
        callerNumber: (currentCall as any)?.callerNumber,
        callerName: 'Conference Call',
      };
      
      const newCall = device.newCall(callOptions);
      newCall.invite();
      
      // Wait for the call to connect
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Call timeout")), 30000);
        
        // Create handler function to properly clean up
        const notificationHandler = (notification: any) => {
          if (notification.type === 'callUpdate' && notification.call && notification.call === newCall) {
            const state = notification.call.state;
            if (state === 'active') {
              clearTimeout(timeout);
              device.off('telnyx.notification', notificationHandler);
              resolve(notification.call);
            } else if (state === 'hangup' || state === 'destroy') {
              clearTimeout(timeout);
              device.off('telnyx.notification', notificationHandler);
              reject(new Error("Call failed"));
            }
          }
        };
        
        // Use the device to listen for call updates
        device.on('telnyx.notification', notificationHandler);
        
        // Ensure cleanup on timeout
        setTimeout(() => {
          device.off('telnyx.notification', notificationHandler);
        }, 30000);
      });
      
      // Once connected, add them to the conference
      const newCallControlId = newCall.telnyxIDs?.telnyxCallControlId;
      
      if (newCallControlId) {
        await fetch("/api/calls/conference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callControlId: newCallControlId,
            command: "join",
            conferenceId,
          }),
        });
        
        console.log("✅ Participant added to conference");
      }
      
    } catch (error) {
      console.error("❌ Failed to add participant:", error);
      throw error;
    }
  };

  return (
    <TelnyxContext.Provider
      value={{
        device,
        activeCall,
        status,
        connectCall,
        disconnectCall,
        toggleMute,
        unmute,
        toggleHold,
        unhold,
        startRecording,
        stopRecording,
        transfer,
        sendDTMF,
        joinConference,
        leaveConference,
        addToConference,
      }}
    >
      {children}
      <IncomingCall 
        device={device} 
        activeCall={activeCall}
        pendingConference={null}
        onAccept={() => {}}
        onDecline={() => {}}
      />
    </TelnyxContext.Provider>
  );
}

export { TelnyxDeviceProvider };
export default TelnyxDeviceProvider;
