/**
 * Audio feedback utilities for call states
 * Generates ringtones and dialing tones using Web Audio API
 */

class AudioFeedback {
  private audioContext: AudioContext | null = null;
  private ringtoneInterval: NodeJS.Timeout | null = null;
  private dialingInterval: NodeJS.Timeout | null = null;
  private currentOscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isInitialized: boolean = false;

  private async initAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      this.gainNode.gain.value = 0.1; // Keep volume low
      
      // Handle browser autoplay policy - resume if suspended
      if (this.audioContext.state === 'suspended') {
        console.log('🔊 Audio context suspended, attempting to resume...');
        try {
          await this.audioContext.resume();
          console.log('✅ Audio context resumed');
        } catch (e) {
          console.warn('⚠️ Could not resume audio context:', e);
          // Will retry on user interaction
        }
      }
      
      this.isInitialized = true;
    } else if (this.audioContext.state === 'suspended') {
      // Try to resume if suspended
      try {
        await this.audioContext.resume();
      } catch (e) {
        console.warn('⚠️ Audio context still suspended');
      }
    }
  }
  
  /**
   * Ensure audio context is ready (handle autoplay policy)
   */
  async ensureAudioReady(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initAudioContext();
    }
    
    if (this.audioContext?.state === 'suspended') {
      // Add click handler to resume on user interaction
      const resumeAudio = async () => {
        if (this.audioContext?.state === 'suspended') {
          try {
            await this.audioContext.resume();
            console.log('✅ Audio resumed after user interaction');
            document.removeEventListener('click', resumeAudio);
            document.removeEventListener('keydown', resumeAudio);
          } catch (e) {
            console.error('Failed to resume audio:', e);
          }
        }
      };
      
      document.addEventListener('click', resumeAudio);
      document.addEventListener('keydown', resumeAudio);
      
      return false; // Audio not ready yet
    }
    
    return true;
  }

  /**
   * Play a ringtone pattern (ring-ring... pause... ring-ring... pause)
   * For incoming calls, use a different frequency to distinguish
   */
  async startRingtone(isIncoming: boolean = false) {
    this.stopAllSounds();
    await this.initAudioContext();

    if (!this.audioContext || !this.gainNode) return;

    const frequency = isIncoming ? 523 : 440; // C5 for incoming, A4 for outgoing
    console.log(isIncoming ? '🔔 Starting incoming ringtone' : '🔔 Starting outbound ringtone');

    const playRingPattern = () => {
      if (!this.audioContext || !this.gainNode) return;

      // Play two rings with different pattern for incoming
      if (isIncoming) {
        // Incoming: longer rings, more urgent
        this.playTone(frequency, 500); // First ring
        setTimeout(() => {
          this.playTone(frequency, 500); // Second ring
        }, 700);
        setTimeout(() => {
          this.playTone(frequency * 1.25, 200); // Higher third ring
        }, 1500);
      } else {
        // Outgoing: standard pattern
        this.playTone(frequency, 400); // First ring
        setTimeout(() => {
          this.playTone(frequency, 400); // Second ring
        }, 600);
      }
    };

    // Play immediately
    playRingPattern();

    // Then repeat (different intervals for incoming/outgoing)
    const interval = isIncoming ? 2500 : 3000;
    this.ringtoneInterval = setInterval(playRingPattern, interval);
  }

  /**
   * Play a dialing tone (continuous low frequency tone)
   * US standard: 350Hz + 440Hz combined
   */
  async startDialingTone() {
    this.stopAllSounds();
    await this.initAudioContext();

    if (!this.audioContext || !this.gainNode) return;

    console.log('📞 Starting dialing tone');

    // Create two oscillators for US dialing tone
    const osc1 = this.audioContext.createOscillator();
    const osc2 = this.audioContext.createOscillator();
    
    osc1.frequency.value = 350;
    osc2.frequency.value = 440;
    
    // Lower volume for dialing tone
    const dialGain = this.audioContext.createGain();
    dialGain.gain.value = 0.05;
    
    osc1.connect(dialGain);
    osc2.connect(dialGain);
    dialGain.connect(this.audioContext.destination);
    
    osc1.start();
    osc2.start();
    
    // Store reference to stop later
    this.currentOscillator = osc1;
    
    // Stop after 30 seconds max (safety)
    this.dialingInterval = setTimeout(() => {
      osc1.stop();
      osc2.stop();
      this.currentOscillator = null;
    }, 30000);
  }

  /**
   * Play a busy signal (fast beeps)
   */
  async startBusySignal() {
    this.stopAllSounds();
    await this.initAudioContext();

    if (!this.audioContext || !this.gainNode) return;

    console.log('📵 Starting busy signal');

    const playBusyBeep = () => {
      this.playTone(480, 250); // Busy tone frequency and duration
    };

    // Play immediately
    playBusyBeep();

    // Then repeat every 500ms
    this.ringtoneInterval = setInterval(playBusyBeep, 500);

    // Auto-stop after 5 seconds
    setTimeout(() => this.stopAllSounds(), 5000);
  }

  /**
   * Play a single tone
   */
  private playTone(frequency: number, duration: number) {
    if (!this.audioContext || !this.gainNode) return;

    const oscillator = this.audioContext.createOscillator();
    oscillator.frequency.value = frequency;
    oscillator.connect(this.gainNode);
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration / 1000);
  }

  /**
   * Stop all audio feedback
   */
  stopAllSounds() {
    console.log('🔇 Stopping audio feedback');

    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }

    if (this.dialingInterval) {
      clearTimeout(this.dialingInterval);
      this.dialingInterval = null;
    }

    if (this.currentOscillator) {
      try {
        this.currentOscillator.stop();
      } catch (e) {
        // Already stopped
      }
      this.currentOscillator = null;
    }
  }

  /**
   * Play a quick connection sound
   */
  async playConnectedSound() {
    this.stopAllSounds();
    await this.initAudioContext();

    if (!this.audioContext || !this.gainNode) return;

    console.log('✅ Playing connected sound');

    // Play two quick ascending tones
    this.playTone(523, 100); // C5
    setTimeout(() => {
      this.playTone(659, 100); // E5
    }, 120);
  }

  /**
   * Play a disconnection sound
   */
  async playDisconnectedSound() {
    this.stopAllSounds();
    await this.initAudioContext();

    if (!this.audioContext || !this.gainNode) return;

    console.log('📵 Playing disconnected sound');

    // Play two quick descending tones
    this.playTone(659, 100); // E5
    setTimeout(() => {
      this.playTone(523, 100); // C5
    }, 120);
  }

  /**
   * Cleanup audio context
   */
  destroy() {
    this.stopAllSounds();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.gainNode = null;
  }
}

// Export class for instance creation
export { AudioFeedback };

// Also export a default singleton for backward compatibility
export const audioFeedback = new AudioFeedback();
