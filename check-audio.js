// Run this in browser console to check WebRTC audio

// 1. Check microphone permission
async function checkMicrophone() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log("✅ Microphone access granted");
    console.log("Audio tracks:", stream.getAudioTracks());
    stream.getTracks().forEach(track => track.stop());
  } catch (err) {
    console.error("❌ Microphone access failed:", err);
  }
}

// 2. Check during active call
function checkActiveCall() {
  // Find the active call in React DevTools or from global context
  const activeCall = window.activeCall || 
    document.querySelector('[data-active-call]')?.activeCall;
    
  if (!activeCall) {
    console.log("No active call found");
    return;
  }
  
  console.log("Call state:", activeCall.state);
  console.log("Local stream:", activeCall.localStream);
  console.log("Remote stream:", activeCall.remoteStream);
  
  if (activeCall.localStream) {
    const audioTracks = activeCall.localStream.getAudioTracks();
    console.log("Local audio tracks:", audioTracks);
    audioTracks.forEach(track => {
      console.log("  Track enabled:", track.enabled);
      console.log("  Track muted:", track.muted);
      console.log("  Track settings:", track.getSettings());
    });
  }
  
  if (activeCall.remoteStream) {
    const audioTracks = activeCall.remoteStream.getAudioTracks();
    console.log("Remote audio tracks:", audioTracks);
  }
}

// 3. Check WebRTC stats
async function checkWebRTCStats() {
  const pc = window.pc || window.activeCall?.pc;
  if (!pc) {
    console.log("No peer connection found");
    return;
  }
  
  const stats = await pc.getStats();
  stats.forEach(stat => {
    if (stat.type === 'inbound-rtp' && stat.mediaType === 'audio') {
      console.log("Inbound audio:", stat);
    }
    if (stat.type === 'outbound-rtp' && stat.mediaType === 'audio') {
      console.log("Outbound audio:", stat);
    }
  });
}

console.log("Audio diagnostic functions loaded:");
console.log("- checkMicrophone() - Test mic access");
console.log("- checkActiveCall() - Check call audio streams");
console.log("- checkWebRTCStats() - Check WebRTC statistics");
console.log("\nTelnyx Echo Test: +1 (312) 281-2096");