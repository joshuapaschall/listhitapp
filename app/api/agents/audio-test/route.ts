export const runtime = "nodejs"
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Return an HTML page with audio diagnostics
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Agent Audio Test</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    .test-section {
      margin: 20px 0;
      padding: 20px;
      border: 1px solid #ccc;
      border-radius: 8px;
    }
    button {
      padding: 10px 20px;
      margin: 5px;
      cursor: pointer;
    }
    .log {
      background: #f0f0f0;
      padding: 10px;
      margin: 10px 0;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      max-height: 300px;
      overflow-y: auto;
    }
    .status {
      padding: 5px 10px;
      border-radius: 4px;
      display: inline-block;
      margin: 5px 0;
    }
    .status.good { background: #4caf50; color: white; }
    .status.bad { background: #f44336; color: white; }
    .status.warning { background: #ff9800; color: white; }
  </style>
</head>
<body>
  <h1>Agent Audio Diagnostics</h1>
  
  <div class="test-section">
    <h2>1. Browser Audio Permissions</h2>
    <button onclick="testMicrophone()">Test Microphone Access</button>
    <div id="mic-status"></div>
  </div>
  
  <div class="test-section">
    <h2>2. Audio Elements</h2>
    <button onclick="checkAudioElements()">Check Audio Elements</button>
    <div id="audio-status"></div>
  </div>
  
  <div class="test-section">
    <h2>3. Test Audio Playback</h2>
    <button onclick="testPlayback()">Play Test Sound</button>
    <div id="playback-status"></div>
  </div>
  
  <div class="test-section">
    <h2>4. WebRTC Audio Test</h2>
    <button onclick="testWebRTCAudio()">Test WebRTC Audio</button>
    <div id="webrtc-status"></div>
  </div>
  
  <div class="test-section">
    <h2>Console Log</h2>
    <div id="log" class="log"></div>
  </div>
  
  <script>
    function log(message, type = 'info') {
      const logDiv = document.getElementById('log');
      const time = new Date().toLocaleTimeString();
      const color = type === 'error' ? 'red' : type === 'success' ? 'green' : 'black';
      logDiv.innerHTML += \`<div style="color: \${color}">\${time} - \${message}</div>\`;
      logDiv.scrollTop = logDiv.scrollHeight;
    }
    
    async function testMicrophone() {
      const statusDiv = document.getElementById('mic-status');
      try {
        log('Requesting microphone access...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        
        const tracks = stream.getAudioTracks();
        statusDiv.innerHTML = '<div class="status good">✓ Microphone Access Granted</div>';
        
        tracks.forEach(track => {
          log(\`Audio track: \${track.label}, enabled: \${track.enabled}, muted: \${track.muted}\`, 'success');
        });
        
        // Stop tracks after test
        setTimeout(() => {
          tracks.forEach(track => track.stop());
          log('Microphone test completed, tracks stopped');
        }, 2000);
        
      } catch (error) {
        statusDiv.innerHTML = '<div class="status bad">✗ Microphone Access Denied</div>';
        log(\`Microphone error: \${error.message}\`, 'error');
      }
    }
    
    function checkAudioElements() {
      const statusDiv = document.getElementById('audio-status');
      const audioElements = document.querySelectorAll('audio');
      
      if (audioElements.length === 0) {
        statusDiv.innerHTML = '<div class="status warning">No audio elements found</div>';
        log('No audio elements in DOM', 'warning');
      } else {
        let html = '';
        audioElements.forEach((audio, index) => {
          const status = {
            id: audio.id || 'unnamed',
            srcObject: audio.srcObject ? 'Yes' : 'No',
            src: audio.src || 'None',
            autoplay: audio.autoplay,
            muted: audio.muted,
            paused: audio.paused,
            readyState: audio.readyState
          };
          
          html += \`<div class="status \${audio.srcObject ? 'good' : 'warning'}">
            Audio #\${index + 1} (ID: \${status.id})<br>
            Has stream: \${status.srcObject}, Autoplay: \${status.autoplay}, 
            Muted: \${status.muted}, Ready: \${status.readyState}
          </div>\`;
          
          log(\`Audio element \${status.id}: \${JSON.stringify(status)}\`);
        });
        statusDiv.innerHTML = html;
      }
    }
    
    async function testPlayback() {
      const statusDiv = document.getElementById('playback-status');
      try {
        log('Creating test audio...');
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBBxmuu7trGMfBTCU2/7AfCQDIHLC9OiZShAKU7Dq67NlJAU+rN/7unEcBCp8yfDjgjUKHny35+2hTxAMTbLw9bliKAg+tOb4wH4fBSuBzvXJfywFJGnE8+OaSRIKUK7s8K9jGgU7mdn7v3woCSnE8ehzRhYFFrTu9ca4UQwNk+n7sGwhBjCW3/yvZhcHOqHZ+8ByIAUlhuDqpV0TBSiW1+zAcRECJYHO6aBLEgg5eMrvn1USDBah0+6jYhoKL5rY+7h6IhAka8nr0H8yBSmP1vK/ciQGIIPc5sVXDg0emefq0JdJFg+16/XQajAI');
        
        statusDiv.innerHTML = '<div class="status warning">Playing test sound...</div>';
        
        await audio.play();
        log('Test sound playing', 'success');
        statusDiv.innerHTML = '<div class="status good">✓ Audio playback working</div>';
        
      } catch (error) {
        statusDiv.innerHTML = '<div class="status bad">✗ Audio playback failed</div>';
        log(\`Playback error: \${error.message}\`, 'error');
        log('Try clicking this button again after interacting with the page', 'warning');
      }
    }
    
    async function testWebRTCAudio() {
      const statusDiv = document.getElementById('webrtc-status');
      try {
        log('Creating WebRTC peer connection...');
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.telnyx.com:3478' }]
        });
        
        pc.onicecandidate = (e) => {
          if (e.candidate) {
            log(\`ICE candidate: \${e.candidate.type} - \${e.candidate.protocol}\`);
          }
        };
        
        pc.oniceconnectionstatechange = () => {
          log(\`ICE connection state: \${pc.iceConnectionState}\`);
        };
        
        // Add local stream
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
          log(\`Added local track: \${track.kind}\`, 'success');
        });
        
        // Create and set local description
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        statusDiv.innerHTML = '<div class="status good">✓ WebRTC initialized successfully</div>';
        log('WebRTC peer connection created', 'success');
        
        // Cleanup after 5 seconds
        setTimeout(() => {
          pc.close();
          stream.getTracks().forEach(track => track.stop());
          log('WebRTC test completed, connection closed');
        }, 5000);
        
      } catch (error) {
        statusDiv.innerHTML = '<div class="status bad">✗ WebRTC test failed</div>';
        log(\`WebRTC error: \${error.message}\`, 'error');
      }
    }
    
    // Check audio elements on load
    window.onload = () => {
      checkAudioElements();
      log('Audio diagnostics page loaded');
    };
  </script>
</body>
</html>
  `;
  
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}
