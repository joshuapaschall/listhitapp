'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
} from 'react';
import {
  TelnyxRTC,
  Call,
  INotification,
  IClientOptions,
} from '@telnyx/webrtc';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { AudioFeedback } from '@/utils/audio-feedback';
import { toast } from 'sonner';

async function safeJson(res: Response) {
  const ct = res.headers.get('content-type') || '';
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j?.error || msg;
    } catch { }
    throw new Error(msg);
  }
  if (!ct.includes('application/json')) {
    throw new Error('Unexpected response format');
  }
  return res.json();
}

// Type for TelnyxRTC with runtime properties
type ExtendedTelnyxRTC = TelnyxRTC & {
  emit?: (event: string, ...args: any[]) => void;
  removeListener?: (event: string, handler: any) => void;
};

// Type for Call with runtime properties  
type ExtendedCall = Call & {
  telnyxSessionId?: string;
  telnyxCallControlId?: string;
  telnyxLegId?: string;
  options?: {
    remoteCallerName?: string;
    remoteCallerNumber?: string;
    telnyxIDs?: {
      telnyxSessionId?: string;
      telnyxCallControlId?: string;
      telnyxLegId?: string;
    };
  };
  customHeaders?: Record<string, any>;
};

// Type for INotification with runtime properties
type ExtendedNotification = INotification & {
  call?: ExtendedCall;
  prevState?: string;
};

export interface AgentTelnyxContextValue {
  device: TelnyxRTC | null;
  activeCall: Call | null;
  status: 'idle' | 'connecting' | 'on-call' | 'error';
  disconnectCall: () => void;
  answerCall: () => void;
  toggleMute: () => void;
  toggleHold: () => Promise<void>;
  makeCall: (destination: string, buyerId?: string, fromNumber?: string) => Promise<any>;
  isMuted: boolean;
  isOnHold: boolean;
  customerLegId: string | null;
}

const AgentTelnyxContext = createContext<AgentTelnyxContextValue | undefined>(undefined);

export function useAgentTelnyx(): AgentTelnyxContextValue {
  const ctx = useContext(AgentTelnyxContext);
  if (!ctx) throw new Error('useAgentTelnyx must be used inside AgentTelnyxProvider');
  return ctx;
}

export const getAccessToken = async () => {

  const supabase = supabaseBrowser();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    console.warn(
      '[AgentTelnyx] No Supabase session available; aborting Telnyx token fetch.',
    );
    throw new Error('Sign in required');
  }
  return accessToken
}
export function AgentTelnyxProvider({
  agent,
  children,
}: {
  agent: { id: string; display_name: string; email: string; sip_username: string | null };
  children: ReactNode;
}) {
  const [device, setDevice] = useState<TelnyxRTC | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [status, setStatus] = useState<AgentTelnyxContextValue['status']>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const agentId = agent?.id;
  const [customerLegId, setCustomerLegId] = useState<string | null>(null);

  const fetchTelnyxCredentials = async () => {
    const supabase = supabaseBrowser();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    if (!accessToken) {
      console.warn(
        '[AgentTelnyx] No Supabase session available; aborting Telnyx token fetch.',
      );
      throw new Error('Sign in required');
    }

    const response = await fetch('/api/telnyx/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
      cache: 'no-store',
    });

    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = json?.error || `Request failed (${response.status})`;
      throw new Error(message);
    }

    if (!json?.sip_username) {
      console.error('No SIP username for this agent.');
      toast.error('No SIP username configured for this agent.');
      throw new Error('Agent missing SIP username');
    }

    if (!json?.token) {
      throw new Error('Telnyx token missing from response');
    }

    return json;
  };

  // Keep Call instances in a Map as recommended
  const callsRef = useRef(new Map<string, Call>());
  const activeCallRef = useRef(activeCall);
  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);

  // Track created audio elements for cleanup
  const audioElementsRef = useRef<Set<HTMLAudioElement>>(new Set());

  // Token refresh timer
  const tokenRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tokenExpiryRef = useRef<Date | null>(null);
  const deviceRef = useRef<TelnyxRTC | null>(null);

  // Track if we're expecting an outbound call (for auto-answer)
  const expectingOutboundCallRef = useRef<boolean>(false);

  // Track all timeouts for cleanup
  const timeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());

  // Create instance-specific audio feedback to avoid conflicts
  const audioFeedbackRef = useRef<AudioFeedback | null>(null);

  // Helper to create tracked timeouts that auto-cleanup
  const createTrackedTimeout = (callback: () => void, delay: number): NodeJS.Timeout => {
    const timeout = setTimeout(() => {
      timeoutsRef.current.delete(timeout);
      callback();
    }, delay);
    timeoutsRef.current.add(timeout);
    return timeout;
  };

  // Helper to clear a tracked timeout
  const clearTrackedTimeout = (timeout: NodeJS.Timeout | null) => {
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(timeout);
    }
  };

  // Helper to safely cleanup an audio element
  const cleanupAudioElement = (audio: HTMLAudioElement | null) => {
    if (!audio) return;

    try {
      // Stop media stream tracks
      if (audio.srcObject) {
        const stream = audio.srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
        audio.srcObject = null;
      }

      // Pause and remove from DOM
      audio.pause();
      audio.src = '';
      audio.load();
      if (audio.parentNode) {
        audio.remove();
      }

      // Remove from tracking
      audioElementsRef.current.delete(audio);
    } catch (error) {
      console.error('Error cleaning up audio element:', error);
    }
  };

  // Helper to cleanup all audio elements
  const cleanupAllAudioElements = () => {
    audioElementsRef.current.forEach(audio => {
      cleanupAudioElement(audio);
    });
    audioElementsRef.current.clear();
  };

  // Get agent info and JWT token
  useEffect(() => {
    let created: ExtendedTelnyxRTC | null = null;
    let originalEmit: typeof created.emit = null;
    let isMounted = true;
    let isInitializing = false;

    // Store event handlers for cleanup
    const eventHandlers: { event: string; handler: any }[] = [];

    // Helper to add event listener with tracking
    const addTrackedListener = (device: ExtendedTelnyxRTC, event: string, handler: any) => {
      device.on(event, handler);
      eventHandlers.push({ event, handler });
    };

    // Initialize audio feedback instance
    if (!audioFeedbackRef.current) {
      audioFeedbackRef.current = new AudioFeedback();
      console.log('🔊 Created audio feedback instance');
    }
    const audioFeedback = audioFeedbackRef.current;

    const initializeDevice = async () => {
      // Prevent multiple simultaneous initializations
      if (isInitializing || deviceRef.current) {
        console.log('⚠️ Already initializing or device exists, skipping...');
        return;
      }
      isInitializing = true;

      try {
        console.log('🚀 AgentTelnyxProvider initializing...');

        if (!agentId) {
          toast('Please log in');
          setStatus('error');
          return;
        }

        console.log('🔍 Agent data:', {
          id: agentId,
          sip_username: agent.sip_username,
        });

        // Get Telnyx credentials
        console.log('🔑 Fetching Telnyx credentials for agent session');
        let credentials: any;
        try {
          credentials = await fetchTelnyxCredentials();
        } catch (err: any) {
          console.error('❌ Telnyx credential fetch failed:', err);
          if (err?.stack) console.error(err.stack);
          toast.error(err.message);
          setStatus('error');
          return;
        }
        if (!isMounted) return;

        console.log('✅ Got Telnyx credentials response:', {
          hasToken: !!credentials?.token,
          sipUsername: credentials?.sip_username || agent.sip_username || null,
          expiresAt: credentials?.expires_at || null,
        });

        if (!credentials?.token) {
          throw new Error('No Telnyx token received from server');
        }

        const expiresAt = credentials?.expires_at
          ? new Date(credentials.expires_at)
          : new Date(Date.now() + 55 * 60 * 1000)
        tokenExpiryRef.current = expiresAt
        console.log('🕒 Token expires at:', expiresAt.toISOString())

        const sipUsername = credentials?.sip_username || agent.sip_username;
        console.log('📞 SIP username:', sipUsername);

        // Create hidden audio elements for SDK to use
        let localAudio = document.getElementById('agentLocalAudio') as HTMLAudioElement;
        if (!localAudio) {
          localAudio = document.createElement('audio');
          localAudio.id = 'agentLocalAudio';
          localAudio.muted = true; // Mute to prevent echo
          localAudio.autoplay = true;
          document.body.appendChild(localAudio);
          audioElementsRef.current.add(localAudio);
          console.log('🎤 Created local audio element for SDK');
        }

        // Create TelnyxRTC instance with JWT
        const authType = 'JWT';
        console.log('📞 Creating TelnyxRTC with options:', {
          authType,
          debug: true,
          iceServers: [{
            urls: ['stun:stun.telnyx.com:3478']
          }]
        });

        const telnyxOptions: any = {
          debug: true,
          // Documented way: specify elements for SDK to manage
          remoteElement: 'agentRemoteAudio',
          socketUrl: 'wss://rtc.telnyx.com',

          // localElement: 'agentLocalAudio',
          // // ICE servers for better connectivity
          iceServers: [
            {
              urls: ['stun:stun.telnyx.com:3478']
            },
            {
              urls: ['turn:turn.telnyx.com:3478?transport=tcp'],
              username: process.env.NEXT_PUBLIC_TELNYX_TURN_USERNAME || 'testuser',
              credential: process.env.NEXT_PUBLIC_TELNYX_TURN_PASSWORD || 'testpassword'
            }
          ]
        };

        telnyxOptions.login_token = credentials.token;
        // telnyxOptions.login = credentials.login;
        // telnyxOptions.password = credentials.password;
        // console.log('🔐 Using JWT authentication for TelnyxRTC');

        // Cast to any to allow runtime properties that aren't in the type definition
        created = new TelnyxRTC({ ...telnyxOptions, ringtoneFile: '/sounds/on-hold.mp3', host: "wss://rtc.telnyx.com" }) as ExtendedTelnyxRTC;

        // Create audio element if it doesn't exist
        let remoteAudio = document.getElementById('agentRemoteAudio') as HTMLAudioElement;
        if (!remoteAudio) {
          remoteAudio = document.createElement('audio');
          remoteAudio.id = 'agentRemoteAudio';
          remoteAudio.autoplay = true;
          document.body.appendChild(remoteAudio);
          audioElementsRef.current.add(remoteAudio);
          console.log('🔊 Pre-created audio element for remote stream');
        }

        // Log SDK version
        console.log('SDK initialized');

        if (!isMounted) {
          created.disconnect();
          return;
        }

        setDevice(created);
        deviceRef.current = created;

        // Check TelnyxRTC methods for debugging
        console.log('🔍 TelnyxRTC methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(created)).filter(m => typeof (created as any)[m] === 'function'));
        console.log('🔍 TelnyxRTC properties:', Object.keys(created));
        console.log('🔍 Has emit?', created.emit !== undefined, typeof created.emit);
        console.log('🔍 Has on?', 'on' in created, typeof created.on);

        // Connect to Telnyx
        console.log('🔌 Connecting to Telnyx...');
        console.log('🔑 With SIP username:', sipUsername);

        try {
          await created.connect();
          console.log('✅ Connect method completed');
        } catch (connectError) {
          console.error('❌ Connect error:', connectError);
          throw connectError;
        }

        // Set up event handlers
        created.on('telnyx.ready', () => {
          if (!isMounted) return;
          const connectedSIPUsername = created?.options
          console.log('[telnyx] ready');
          console.log('🟢 Telnyx ready - agent connected');
          console.log('📞 Agent ready to receive calls at:', sipUsername);
          console.log("connectedSIPUsername", connectedSIPUsername)
          setStatus('idle');
        });

        created.on('telnyx.error', (error: any) => {
          console.error('[telnyx] error', error);
          console.error('❌ Telnyx error:', error);
          if (!isMounted) return;
          setStatus('error');
        });

        created.on('telnyx.socket.close', () => {
          console.log('🔌 Socket closed');
          if (!isMounted) return;
          setStatus('error');
        });

        created.on('telnyx.socket.open', () => {
          console.log('✅ WebSocket connected');
        });

        created.on('telnyx.socket.message', (msg: any) => {
          // Only log non-ping messages to reduce noise
          if (msg?.method !== 'ping' && msg?.method !== 'pong') {
            console.log('📨 WebSocket message:', JSON.stringify(msg));

            // Check for invite messages
            if (msg?.method === 'telnyx_rtc.invite') {
              console.log('🔔 RAW INVITE DETECTED!');
              console.log('  - CallID:', msg?.params?.callID);
              console.log('  - Direction:', msg?.params?.display_direction);
              console.log('  - From:', msg?.params?.caller_id_number);
              console.log('  - To:', msg?.params?.callee_id_number);
            }
          }
        });

        created.on('telnyx.registered', () => {
          console.log('📝 Agent registered with Telnyx');
        });

        // ICE debugging
        created.on('telnyx.rtc', (event: any) => {
          if (event.type === 'icecandidate') {
            console.log('🧊 ICE candidate:', {
              candidate: event.candidate?.candidate,
              type: event.candidate?.type,
              protocol: event.candidate?.protocol
            });
          } else if (event.type === 'iceconnectionstatechange') {
            console.log('🧊 ICE connection state:', event.state);
          } else if (event.type === 'icegatheringstatechange') {
            console.log('🧊 ICE gathering state:', event.state);
          }
        });

        // Add all possible event listeners for debugging
        created.on('telnyx.invite', (event: any) => {
          console.log('🔔 INVITE event (undocumented):', event);
          // Try handling the invite event directly
          if (event.callID) {
            console.log('📞 Attempting to handle invite directly for callID:', event.callID);
          }
        });

        created.on('telnyx.call.new', (event: any) => {
          console.log('🆕 CALL.NEW event:', event);
        });

        created.on('telnyx.call.received', (event: any) => {
          console.log('📞 CALL.RECEIVED event (undocumented):', event);
        });
        // Main notification handler - this is where ALL call events come through
        created.on('telnyx.notification', async (notification: INotification) => {
          console.log('telnyx.notification', notification?.type)

          if (!isMounted) return;
          console.log('[telnyx] notif', notification?.type);

          console.log('📢 Telnyx notification:', notification.type, notification);

          // Log any notification with call data
          if (notification.call) {
            console.log('📞 Notification has call:', {
              id: notification.call.id,
              state: notification.call.state,
              direction: notification.call.direction,
              // @ts-ignore
              telnyxCallControlId: notification.call.telnyxIDs?.telnyxCallControlId
            });
          }

          // Only handle callUpdate notifications
          if (notification.type !== 'callUpdate') {
            return;
          }

          // This IS the Call instance - use it directly
          const call = notification.call as Call;

          console.log('📞 Call update:', {
            id: call.id,
            state: call.state,
            direction: call.direction,
            // @ts-ignore - prevState exists at runtime but not in type definition
            prevState: notification.prevState || notification.call?.prevState,
            // @ts-ignore - telnyxIDs might not be in types
            telnyxCallControlId: call.telnyxIDs?.telnyxCallControlId,
            // @ts-ignore
            remoteId: call.remoteId || call.options?.remoteCallerNumber || call.options?.destinationNumber
          });

          // Store the call in our Map
          callsRef.current.set(call.id, call);

          // Log all call states for debugging
          console.log(`📞 Call state: ${call.state} (direction: ${call.direction})`);

          // Always update the active call object if it's the same call ID
          // This ensures we have the latest state even if we don't handle it specifically
          if (activeCallRef.current?.id === call.id) {
            const prevState = activeCallRef.current.state;
            if (prevState !== call.state) {
              console.log(`🔄 Call state transition: ${prevState} → ${call.state}`);
            }
            setActiveCall(call); // Always keep the call object updated
          }

          // Handle different call states
          switch (call.state) {
            case 'new':
              console.log('🆕 New call state detected');
              // For outbound calls, set as active immediately
              if (call.direction === 'outbound') {
                console.log('📤 Outbound call initiated');
                setActiveCall(call);
                setStatus('on-call');
                setIsMuted(false);
                setIsOnHold(false);
              }
              break;

            case 'trying':
              console.log('🔄 Call is trying...');
              // Also set for trying state if not already set
              if (call.direction === 'outbound' && !activeCallRef.current) {
                console.log('📤 Outbound call trying');
                setActiveCall(call);
                setStatus('on-call');
                // Play dialing tone for outbound calls
                audioFeedback.startDialingTone();
              }
              break;

            case 'ringing':
              console.log('🔔 Call is ringing!');
              console.log('📞 Call object:', {
                id: call.id,
                direction: call.direction,
                state: call.state,
                // @ts-ignore
                hasPeer: !!call.peer,
                // @ts-ignore
                peerState: call.peer?.signalingState || 'no-peer',
                // @ts-ignore
                customHeaders: call.customHeaders || {}
              });

              // For outbound calls, update state if needed
              if (call.direction === 'outbound') {
                console.log('📤 Outbound call ringing at destination');
                if (!activeCallRef.current) {
                  setActiveCall(call);
                  setStatus('on-call');
                }
                // Stop dialing tone and start outbound ringtone
                audioFeedback.startRingtone(false);
              }
              // For inbound calls, check if we need to track them
              else if (call.direction === 'inbound' || call.direction === undefined) {
                console.log('🔔 Incoming call detected! Direction:', call.direction);
                console.log('   expectingOutboundCallRef:', expectingOutboundCallRef.current);
                console.log('   activeCallRef:', activeCallRef.current ? 'exists' : 'null');
                console.log('   activeCall state:', activeCallRef.current?.state);

                // Check if this is an expected outbound bridge call FIRST
                // This must be checked before any other logic
                if (expectingOutboundCallRef.current) {
                  console.log('🤖 AUTO-ANSWERING: Expected outbound bridge call');

                  // Reset the flag immediately to prevent double-processing
                  expectingOutboundCallRef.current = false;

                  // Don't play incoming ringtone for auto-answer calls
                  audioFeedback.stopAllSounds();

                  // Set the call as active immediately
                  setActiveCall(call);
                  activeCallRef.current = call; // Update ref immediately
                  setStatus('on-call');
                  setIsMuted(false);
                  setIsOnHold(false);

                  // Automatically answer the call - SIMPLIFIED for outbound reliability
                  if (typeof call.answer === 'function') {
                    console.log('🚀 Auto-answering outbound bridge call...');
                    console.log('   Call state:', call.state);
                    console.log('   Has answer method:', typeof call.answer === 'function');

                    // For outbound calls, answer immediately without complex checks
                    // The server has already validated and initiated the call
                    const attemptAutoAnswer = () => {
                      try {
                        // Just answer it - no SDP checks for outbound calls
                        call.answer();
                        console.log('✅ Auto-answered outbound call successfully');

                        // Stop any sounds and play connected sound
                        audioFeedback.stopAllSounds();
                        audioFeedback.playConnectedSound();

                        // Store the call in our active call record
                        activeCallRef.current = call;

                      } catch (error: any) {
                        console.error('❌ Auto-answer attempt failed:', error);
                        console.error('   Error message:', error.message);
                        console.error('   Call state now:', call.state);

                        // If call is already active, that's fine
                        if (call.state === 'active') {
                          console.log('✅ Call already active, no answer needed');
                          audioFeedback.stopAllSounds();
                          audioFeedback.playConnectedSound();
                          activeCallRef.current = call;
                        } else if (call.state === 'ringing') {
                          // Still ringing, try once more after a delay
                          console.log('⏳ Call still ringing, retrying in 500ms...');
                          createTrackedTimeout(() => {
                            if (!isMounted) return; // Component unmounted, don't execute
                            try {
                              call.answer();
                              console.log('✅ Auto-answer succeeded on retry');
                              audioFeedback.stopAllSounds();
                              audioFeedback.playConnectedSound();
                            } catch (retryError) {
                              console.error('❌ Auto-answer retry failed:', retryError);
                              console.log('⚠️ User must manually answer the call');
                              // Show a notification to the user
                              toast.error('Please click Answer to connect the call');
                            }
                          }, 500);
                        }
                      }
                    };

                    // Try immediately first
                    attemptAutoAnswer();
                  } else {
                    console.error('❌ Call object missing answer method!');
                    console.log('   Call object:', call);
                  }

                } else {
                  // Regular inbound call (not an expected outbound bridge)
                  console.log('📞 Regular inbound call - playing ringtone');
                  audioFeedback.startRingtone(true); // Incoming ringtone pattern

                  if (!activeCallRef.current) {
                    console.log('📞 Setting incoming call as active');
                    setActiveCall(call);
                    activeCallRef.current = call;
                    setStatus('on-call');
                    setIsMuted(false);
                    setIsOnHold(false);

                    // Check if this is a SIP call (no peer connection)
                    // @ts-ignore
                    if (!call.peer) {
                      console.log('🔄 SIP call detected - will auto-connect');
                      console.log('⏳ Waiting for auto-connection...');

                      // For SIP calls, they often auto-answer/connect
                      // Set a timeout to check if it auto-connects
                      createTrackedTimeout(() => {
                        if (!isMounted) return; // Component unmounted, don't execute
                        if (activeCallRef.current?.state === 'ringing') {
                          console.log('⚠️ Call still ringing after 2 seconds');
                          console.log('📞 You may need to manually answer');
                        } else if (activeCallRef.current?.state === 'active') {
                          console.log('✅ Call auto-connected successfully');
                        }
                      }, 2000);
                    } else {
                      console.log('📞 WebRTC call with peer connection - manual answer required');
                    }
                  } else {
                    console.log('⚠️ Active call already exists, not replacing');
                  }
                }
              }
              break;

            case 'answered':
            case 'active':
              console.log('📞 Call is active/answered:', call.state);
              // @ts-ignore - prevState exists at runtime but not in type definition
              const prevState = notification.prevState || notification.call?.prevState;
              console.log('🔄 Previous state:', prevState);

              // Check if this was an auto-connect (ringing -> active without manual answer)
              if (prevState === 'ringing' && call.state === 'active') {
                console.log('✨ Call AUTO-CONNECTED (ringing → active)');
                console.log('📞 This is typical for SIP bridged calls');
                console.log('✅ No manual answer was needed');
              } else if (prevState === 'new' && call.state === 'active') {
                console.log('✨ Call went directly to ACTIVE (new → active)');
                console.log('📞 Instant connection - likely attached/bridged leg');
              } else if (prevState === 'held' && call.state === 'active') {
                console.log('▶️ Call resumed from hold (held → active)');
                // Don't reset isOnHold here - let toggleHold manage it
              } else if (!prevState && call.state === 'active') {
                console.log('⚡ Call arrived already ACTIVE (no previous state)');
                console.log('📞 This happens with pre-connected bridge calls');
                // If we're expecting an outbound call, this is our bridge
                if (expectingOutboundCallRef.current) {
                  console.log('✅ This is our expected outbound bridge call');
                  expectingOutboundCallRef.current = false;
                }
              }

              // Always update for active calls
              if (!activeCallRef.current || activeCallRef.current.id === call.id) {
                console.log('✅ Setting/updating active call');
                setActiveCall(call);
                setStatus('on-call');

                // Only reset these for new calls, not when resuming from hold
                if (prevState !== 'held') {
                  setIsMuted(false);
                  setIsOnHold(false);
                  // Stop any ringtone/dialing and play connected sound
                  audioFeedback.stopAllSounds();
                  audioFeedback.playConnectedSound();
                }

                // Create agent_active_calls record for hold support
                // Always create/update the record when a call becomes active
                // This ensures hold functionality works even if the outbound API fails
                if (agentId && prevState !== 'active') {
                  // @ts-ignore - telnyxIDs might not be in types
                  const callControlId = call.telnyxIDs?.telnyxCallControlId || call.id;

                  console.log('📝 Creating/updating agent_active_calls record');
                  console.log('  - Call direction:', call.direction);
                  console.log('  - Agent ID:', agentId);
                  console.log('  - Call Control ID:', callControlId);
                  console.log('  - Previous state:', prevState);

                  // Use the new create endpoint that doesn't rely on cookies
                  fetch('/api/agents/active-call/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAccessToken()}`},
                    body: JSON.stringify({
                      callControlId: callControlId,
                    }),
                  })
                    .then(async (response) => {
                      if (!response.ok) {
                        console.error('⚠️ Failed to store active call record:', response.status)
                        const text = await response.text()
                        console.error('Error details:', text)
                      } else {
                        const data = await safeJson(response)
                        console.log('✅ Active call record stored for hold support')
                        console.log('📋 Record data:', data)
                      }
                    })
                    .catch((error) => {
                      console.error('❌ Error storing active call:', error)
                    })
                }
              }

              // Bind remote stream to audio element
              if (call.remoteStream) {
                console.log('🔊 Remote stream available, attaching to audio element');

                // Create or get audio element
                let remoteAudio = document.getElementById('agentRemoteAudio') as HTMLAudioElement;
                if (!remoteAudio) {
                  remoteAudio = document.createElement('audio');
                  remoteAudio.id = 'agentRemoteAudio';
                  remoteAudio.autoplay = true;
                  document.body.appendChild(remoteAudio);
                  audioElementsRef.current.add(remoteAudio);
                  console.log('🔊 Created audio element');
                }

                // Attach stream
                remoteAudio.srcObject = call.remoteStream;
                console.log('✅ Remote stream attached to audio element');

                // Try to play audio (handle autoplay policy)
                remoteAudio.play().then(() => {
                  console.log('🔊 Audio playback started');
                }).catch((playError) => {
                  console.error('❌ Audio playback failed:', playError);
                  console.log('⚠️ Click anywhere on the page to enable audio');
                  // Try to play on user interaction
                  document.addEventListener('click', () => {
                    remoteAudio.play().then(() => {
                      console.log('🔊 Audio playback started after user interaction');
                    }).catch(e => {
                      console.error('❌ Still cannot play audio:', e);
                    });
                  }, { once: true });
                });

                // Log media tracks
                console.log('🎤 Remote tracks:', call.remoteStream.getTracks().map(t => ({
                  kind: t.kind,
                  enabled: t.enabled,
                  muted: t.muted,
                  readyState: t.readyState
                })));
              } else {
                console.warn('⚠️ No remote stream available');
              }

              // Verify local stream is working
              // @ts-ignore
              if (call.localStream) {
                // @ts-ignore
                const localTracks = call.localStream.getAudioTracks();
                console.log('🎤 Local audio is being transmitted:', localTracks.map(t => ({
                  enabled: t.enabled,
                  muted: t.muted,
                  readyState: t.readyState
                })));

                if (localTracks.some(t => !t.enabled)) {
                  console.warn('⚠️ Some local audio tracks are disabled!');
                }
              } else {
                console.warn('⚠️ No local stream on active call - caller may not hear you!');
              }

              break;

            case 'held':
              console.log('⏸️ Call is on hold');
              // Update the active call state
              if (activeCallRef.current?.id === call.id) {
                console.log('📞 Updating call to held state');
                setActiveCall(call);
                setStatus('on-call'); // Keep on-call status
                // Note: isOnHold is managed by toggleHold function
              }
              break;

            case 'hangup':
            case 'destroy':
            case 'purge':
            case 'failed':
            case 'busy':
            case 'rejected':
              console.log('📵 Call ended:', call.state);

              // Play appropriate sound based on state
              if (call.state === 'busy') {
                console.log('📵 Line busy');
                audioFeedback.startBusySignal();
              } else if (call.state === 'failed' || call.state === 'rejected') {
                console.log('❌ Call failed/rejected');
                audioFeedback.stopAllSounds();
                audioFeedback.playDisconnectedSound();
              }

              callsRef.current.delete(call.id);
              if (activeCallRef.current?.id === call.id) {
                setActiveCall(null);
                setStatus('idle');
                setIsMuted(false);
                setIsOnHold(false);
                setCustomerLegId(null);

                // Clean up agent_active_calls record when call ends
                if (agentId) {
                  console.log('🧹 Cleaning up agent_active_calls for ended call');
                  fetch('/api/agents/active-call/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAccessToken()}`},
                    body: JSON.stringify({ agentId })
                  }).catch(error => {
                    console.error('⚠️ Failed to clean up active call record:', error);
                  });
                }

                // Stop all audio feedback and play disconnected sound (if not already playing busy signal)
                if (call.state !== 'busy') {
                  audioFeedback.stopAllSounds();
                  audioFeedback.playDisconnectedSound();
                }

                // Clean up audio element
                const remoteAudio = document.getElementById('agentRemoteAudio') as HTMLAudioElement;
                if (remoteAudio) {
                  cleanupAudioElement(remoteAudio);
                  console.log('🔊 Cleaned up audio element and stopped tracks');
                }
              }

              // Clean up callsRef Map if it gets too large
              if (callsRef.current.size > 10) {
                // Keep only active calls
                const activeCalls = new Map<string, Call>();
                callsRef.current.forEach((call, id) => {
                  if (call.state !== 'hangup' && call.state !== 'destroy') {
                    activeCalls.set(id, call);
                  }
                });
                callsRef.current = activeCalls;
                console.log('🧹 Cleaned up calls map, kept', activeCalls.size, 'active calls');
              }
              break;

            default:
              console.log('⚠️ Unhandled call state:', call.state);
              // For any unhandled state, if it's an outbound call we're tracking, update it
              if (activeCallRef.current?.id === call.id) {
                console.log('📤 Updating tracked call with unhandled state:', {
                  state: call.state,
                  direction: call.direction,
                  id: call.id
                });
                setActiveCall(call); // Keep the call object updated
              }
          }
        });
        // Catch-all for any events we might be missing
        // Only monkey-patch if emit exists
        if (created.emit && typeof created.emit === 'function') {
          originalEmit = created.emit.bind(created);
          created.emit = function (event: string, ...args: any[]) {
            if (event.startsWith('telnyx.') &&
              !['telnyx.socket.message', 'telnyx.rtc', 'telnyx.ready',
                'telnyx.error', 'telnyx.notification', 'telnyx.socket.open',
                'telnyx.socket.close'].includes(event)) {
              console.log(`🔍 Unknown event: ${event}`, args);
            }
            return originalEmit(event, ...args);
          };
        } else {
          console.log('⚠️ TelnyxRTC emit method not available for patching');
        }



      } catch (error) {
        console.error('❌ Failed to initialize agent device:', error);
        if (isMounted) {
          setStatus('error');
        }
      } finally {
        isInitializing = false;
      }
    };

    initializeDevice();

    return () => {
      isMounted = false;

      // Clear all tracked timeouts
      timeoutsRef.current.forEach(timeout => {
        clearTimeout(timeout);
      });
      timeoutsRef.current.clear();

      // Clear token refresh timer
      if (tokenRefreshTimerRef.current) {
        clearTimeout(tokenRefreshTimerRef.current);
      }

      // Stop all audio feedback
      if (audioFeedback) {
        try {
          audioFeedback.stopAllSounds();
          audioFeedback.destroy();
        } catch (error) {
          console.error('Error cleaning up audio feedback:', error);
        }
      }

      // Clean up all audio elements
      cleanupAllAudioElements();
      console.log('🧹 Cleaned up all audio elements and feedback');

      // Clean up calls map
      callsRef.current.clear();

      if (created) {
        console.log('🔌 Cleaning up Telnyx connection');

        // Remove all event listeners
        eventHandlers.forEach(({ event, handler }) => {
          try {
            // @ts-expect-error - off method exists at runtime
            if (created.off) {
              // @ts-expect-error - off method exists at runtime
              created.off(event, handler);
            } else if (created.removeListener) {
              // @ts-expect-error - removeListener might exist
              created.removeListener(event, handler);
            }
          } catch (error) {
            console.error(`Failed to remove listener for ${event}:`, error);
          }
        });

        // Restore original emit if it was modified
        if (originalEmit && typeof originalEmit === 'function' && created.emit !== undefined) {
          created.emit = originalEmit;
        }

        // Disconnect the device
        try {
          created.disconnect();
        } catch (error) {
          console.error('Error disconnecting Telnyx device:', error);
        }
      }
    };
  }, [agentId]); // Re-run if agentId changes

  // Separate useEffect for token refresh
  useEffect(() => {
    if (!agentId || !tokenExpiryRef.current) return;

    const setupTokenRefresh = () => {
      if (tokenRefreshTimerRef.current) {
        clearTimeout(tokenRefreshTimerRef.current);
      }

      const timeUntilRefresh = tokenExpiryRef.current!.getTime() - Date.now();

      if (timeUntilRefresh > 0) {
        console.log(`🕒 Token refresh scheduled in ${Math.round(timeUntilRefresh / 1000 / 60)} minutes`);

        tokenRefreshTimerRef.current = setTimeout(async () => {
          console.log('🔄 Refreshing JWT token...');

          try {
            const data = await fetchTelnyxCredentials();
            if (!data?.token) {
              throw new Error('No Telnyx token received for refresh');
            }
            console.log('✅ Token refreshed successfully');

            // Update expiry time
            tokenExpiryRef.current = new Date(Date.now() + 55 * 60 * 1000);

            // Use deviceRef to avoid dependency issues
            if (deviceRef.current && typeof (deviceRef.current as any).updateToken === 'function') {
              ; (deviceRef.current as any).updateToken(data.token);
              console.log('✅ Updated device with new token');
            } else if (deviceRef.current) {
              console.log("⚠️ Device doesn't support token update, will reconnect on next call");
            }

            // Schedule next refresh
            setupTokenRefresh();
          } catch (error) {
            console.error('❌ Token refresh error:', error);
            toast.error((error as Error).message);
            tokenRefreshTimerRef.current = setTimeout(() => setupTokenRefresh(), 60000);
          }
        }, timeUntilRefresh);
      }
    };

    setupTokenRefresh();

    return () => {
      if (tokenRefreshTimerRef.current) {
        clearTimeout(tokenRefreshTimerRef.current);
      }
    };
  }, [agentId]); // Only depend on agentId

  const disconnectCall = () => {
    if (activeCall) {
      console.log('📵 Hanging up call');
      console.log('  Call ID:', activeCall.id);
      console.log('  Call state:', activeCall.state);
      console.log('  Call direction:', activeCall.direction);

      // Hangup the WebRTC call
      activeCall.hangup();

      // For outbound calls that are still connecting, also call cancel API
      // This ensures both legs are canceled even if the webhook is slow
      if (activeCall.direction === 'inbound' && activeCall.state !== 'active') {
        // This might be an agent-initiated outbound call (appears as inbound to WebRTC)
        // Try to cancel via API as well for faster response
        fetch('/api/agents/calls/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }).catch(err => console.log('⚠️ Cancel API call failed:', err));
      }
    }
  };

  const answerCall = () => {
    if (!activeCall) {
      console.error('❌ No active call to answer');
      return;
    }

    // Allow answering in ringing state or if already trying to connect
    if (activeCall.state !== 'ringing' && activeCall.state !== 'trying') {
      console.log('⚠️ Call is not in ringing state:', activeCall.state);
      // Don't return - still try to answer or update UI
    }

    console.log('📞 Agent clicked Answer button');
    console.log('📞 Call details:', {
      id: activeCall.id,
      state: activeCall.state,
      direction: activeCall.direction,
      // @ts-ignore
      hasPeer: !!activeCall.peer,
      // @ts-ignore
      hasAnswerMethod: typeof activeCall.answer === 'function'
    });

    // Immediately update UI to show call is being answered
    // This gives instant feedback to the agent
    setStatus('on-call');

    // For UI purposes, we can consider the call "answered" from agent's perspective
    // Even if technically it might still be connecting
    const currentCall = activeCall;

    // Try to actually answer the call if the method exists
    if (typeof activeCall.answer === 'function') {
      try {
        console.log('📞 Calling answer() method...');
        activeCall.answer();
        console.log('✅ Answer method called successfully');

        // Force state update if needed
        if (currentCall.state === 'ringing') {
          // Give the SDK a moment to update, then check
          createTrackedTimeout(() => {
            if (!deviceRef.current) return; // Device disconnected
            if (activeCallRef.current?.id === currentCall.id && activeCallRef.current.state === 'ringing') {
              console.log('⚠️ Call still in ringing state after answer, forcing update');
              // The call should transition to active soon
            }
          }, 1000);
        }
      } catch (error: any) {
        console.warn('⚠️ Answer method failed:', error.message);
        // Don't revert UI - from agent's perspective they answered
        // The call might still connect (SIP auto-connect)
      }
    } else {
      console.log('📞 No answer method available (likely SIP call)');
      console.log('🔄 Call should auto-connect or already be connecting');

      // For SIP calls that auto-connect, we just update the UI
      // The actual connection happens automatically
    }

    // Monitor call state to ensure it connects
    let attempts = 0;
    const checkConnection = setInterval(() => {
      attempts++;
      const currentState = activeCallRef.current?.state;

      if (currentState === 'active') {
        console.log('✅ Call is now active after', attempts, 'checks');
        clearInterval(checkConnection);
      } else if (currentState === 'hangup' || currentState === 'destroy' || !activeCallRef.current) {
        console.log('❌ Call ended before connecting');
        clearInterval(checkConnection);
        setStatus('idle');
      } else if (attempts > 20) { // 10 seconds
        console.log('⚠️ Call did not become active after 10 seconds');
        console.log('  Final state:', currentState);
        clearInterval(checkConnection);
        // Don't revert status - let the call continue trying
      }
    }, 500);

    console.log('📞 Answer process completed - call should be connecting');
  };

  const toggleMute = () => {
    if (!activeCall) return;

    if (isMuted) {
      // @ts-ignore - Method exists at runtime
      activeCall.unmuteAudio ? activeCall.unmuteAudio() : activeCall.unmute?.();
      setIsMuted(false);
      console.log('🔊 Unmuted');
    } else {
      // @ts-ignore - Method exists at runtime
      activeCall.muteAudio ? activeCall.muteAudio() : activeCall.mute?.();
      setIsMuted(true);
      console.log('🔇 Muted');
    }
  };

  // Keep this function for future use (transfers, etc)
  // Commented out until needed to avoid unused variable warning
  // const fetchCustomerLegId = async (agentId: string) => {
  //   try {
  //     const response = await fetch(`/api/agents/${agentId}/active-call`);
  //     if (response.ok) {
  //       const data = await response.json();
  //       if (data.customerLegId) {
  //         setCustomerLegId(data.customerLegId);
  //         return data.customerLegId;
  //       }
  //     }
  //   } catch (error) {
  //     console.error('Failed to fetch customer leg ID:', error);
  //   }
  //   return null;
  // };
  const toggleHold = async () => {
    if (!activeCall) return;

    const telnyxSessionId = (activeCall as any)?.telnyxIDs?.telnyxSessionId || (activeCall as any)?.telnyxSessionId;
    const callControlId = (activeCall as any)?.telnyxIDs?.telnyxCallControlId || telnyxSessionId || activeCall.id;

    if (!callControlId) {
      console.error("❌ No call identifier available for hold toggle");
      return;
    }

    try {
      const response = await fetch(`/api/calls/${callControlId}/hold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hold: !isOnHold }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to toggle hold music");
      }

      if (isOnHold) {
        await activeCall.unhold();
        setIsOnHold(false);
        console.log("✅ Call unholded");
      } else {
        await activeCall.hold();
        setIsOnHold(true);
        console.log("✅ Call held");
      }
    } catch (error) {
      console.error("❌ Hold/unhold error:", error);
    }
  };



  const makeCall = async (destination: string, buyerId?: string, fromNumber?: string) => {
    if (!device || status !== 'idle') {
      console.error('Cannot make call - device not ready or already on call');
      throw new Error('Device not ready for outbound call');
    }

    try {
      console.log('📞 Initiating server-orchestrated outbound call to:', destination);

      // IMPORTANT: Don't set the flag yet - wait for API success
      // This prevents phantom auto-answers when the API fails

      // Use the new server-orchestrated approach
      // The server will dial both the agent and customer, then bridge them
      const payload: Record<string, any> = {
        to: destination,
        agentSessionId: agentId,
      };
      if (buyerId) {
        payload.buyerId = buyerId;
      }
      if (fromNumber) {
        payload.from = fromNumber;
      }
      // ========= OLD =========
      // const data = await safeJson(
      //   await fetch('/api/calls/outbound', {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify(payload),
      //   }),
      // );
      // console.log('✅ Server initiated outbound call', data?.data?.data?.call_control_id);
      // return data;

      // ========= New =========
      const clientState = Buffer.from(
            JSON.stringify({ desc:destination, to: agent.sip_username }),
            "utf8",
          ).toString("base64");
      const webRTCcall = device.newCall({
        destinationNumber: destination,
        callerNumber: process.env.NEXT_PUBLIC_FROM_NUMBER,
        audio: true,
        clientState: clientState
      });
      setActiveCall(webRTCcall);
    } catch (error) {
      console.error('❌ Failed to initiate outbound call:', error);
      setStatus('idle');
      throw error;
    }
  };

  const contextValue: AgentTelnyxContextValue = {
    device,
    activeCall,
    status,
    disconnectCall,
    answerCall,
    toggleMute,
    toggleHold,
    makeCall,
    isMuted,
    isOnHold,
    customerLegId,
  };

  return (
    <AgentTelnyxContext.Provider value={contextValue}>
      {children}
    </AgentTelnyxContext.Provider>
  );
}
