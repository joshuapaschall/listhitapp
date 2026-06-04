import { supabaseAdmin } from "@/lib/supabase";
import { TELNYX_API_URL, getTelnyxApiKey } from "@/lib/voice-env";
import { createLogger } from "@/lib/logger";

const log = createLogger("voicemail-service");

const TELNYX_API_KEY = getTelnyxApiKey();

interface VoicemailOptions {
  maxLength?: number;
  silenceTimeout?: number;
  transcriptionEnabled?: boolean;
  playBeep?: boolean;
  greetingMediaName?: string;
  greetingText?: string;
}

export class VoicemailService {
  /**
   * Start voicemail recording for a call
   */
  static async startVoicemail(
    callControlId: string,
    fromNumber: string,
    toNumber: string,
    options: VoicemailOptions = {}
  ) {
    try {
      log('📬 Starting voicemail sequence');
      log('  Call Control ID:', callControlId);
      log('  From:', fromNumber);
      log('  To:', toNumber);

      // Get voicemail box configuration
      const box = await this.getVoicemailBox(toNumber);
      
      // Merge options with box defaults
      const config = {
        maxLength: options.maxLength || box?.max_length_seconds || 180,
        silenceTimeout: options.silenceTimeout || box?.silence_timeout_seconds || 8,
        transcriptionEnabled: options.transcriptionEnabled ?? box?.transcription_enabled ?? true,
        playBeep: options.playBeep ?? box?.play_beep ?? true,
        greetingMediaName: options.greetingMediaName || box?.greeting_media_name,
        greetingText: options.greetingText || box?.greeting_text || 'Please leave a message after the beep.'
      };

      // Step 1: Answer the call if not already answered
      await this.answerCall(callControlId);

      // Step 2: Play greeting
      if (config.greetingMediaName) {
        await this.playGreeting(callControlId, config.greetingMediaName);
      } else {
        // Use text-to-speech if no media greeting
        await this.speakGreeting(callControlId, config.greetingText);
      }

      // Note: The actual recording will start after the greeting ends
      // This is handled in the webhook handler for call.playback.ended
      
      // Store pending voicemail in database
      const voicemail = await this.createPendingVoicemail(
        callControlId,
        fromNumber,
        toNumber,
        box?.id
      );

      return {
        success: true,
        voicemailId: voicemail.id,
        config
      };

    } catch (error) {
      console.error('❌ Failed to start voicemail:', error);
      throw error;
    }
  }

  /**
   * Answer the call
   */
  static async answerCall(callControlId: string) {
    const response = await fetch(
      `${TELNYX_API_URL}/calls/${callControlId}/actions/answer`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TELNYX_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command_id: crypto.randomUUID(),
          client_state: Buffer.from(JSON.stringify({
            action: 'voicemail_answer'
          })).toString('base64')
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Failed to answer call:', error);
      throw new Error('Failed to answer call for voicemail');
    }

    log('✅ Call answered for voicemail');
  }

  /**
   * Play greeting using Telnyx Media Storage
   */
  static async playGreeting(callControlId: string, mediaName: string) {
    const response = await fetch(
      `${TELNYX_API_URL}/calls/${callControlId}/actions/playback_start`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TELNYX_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          media_name: mediaName,
          command_id: crypto.randomUUID(),
          client_state: Buffer.from(JSON.stringify({
            action: 'voicemail_greeting',
            next_action: 'start_recording'
          })).toString('base64')
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Failed to play greeting:', error);
      throw new Error('Failed to play voicemail greeting');
    }

    log('✅ Playing voicemail greeting');
  }

  /**
   * Use text-to-speech for greeting
   */
  static async speakGreeting(callControlId: string, text: string) {
    const response = await fetch(
      `${TELNYX_API_URL}/calls/${callControlId}/actions/speak`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TELNYX_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payload: text,
          voice: 'female',
          language: 'en-US',
          command_id: crypto.randomUUID(),
          client_state: Buffer.from(JSON.stringify({
            action: 'voicemail_tts_greeting',
            next_action: 'start_recording'
          })).toString('base64')
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Failed to speak greeting:', error);
      throw new Error('Failed to speak voicemail greeting');
    }

    log('✅ Speaking voicemail greeting via TTS');
  }

  /**
   * Start recording the voicemail
   */
  static async startRecording(
    callControlId: string,
    maxLength: number = 180,
    silenceTimeout: number = 8,
    transcriptionEnabled: boolean = true
  ) {
    const response = await fetch(
      `${TELNYX_API_URL}/calls/${callControlId}/actions/record_start`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TELNYX_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format: 'mp3',
          channels: 'single',
          play_beep: true,
          max_length: maxLength,
          timeout_secs: silenceTimeout,
          transcription: transcriptionEnabled,
          transcription_engine: 'A', // Google engine
          transcription_language: 'en-US',
          command_id: crypto.randomUUID(),
          client_state: Buffer.from(JSON.stringify({
            action: 'voicemail_recording',
            max_length: maxLength,
            transcription: transcriptionEnabled
          })).toString('base64')
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Failed to start recording:', error);
      throw new Error('Failed to start voicemail recording');
    }

    log('✅ Started voicemail recording');
    log(`  Max length: ${maxLength}s`);
    log(`  Silence timeout: ${silenceTimeout}s`);
    log(`  Transcription: ${transcriptionEnabled}`);
  }

  /**
   * Get voicemail box configuration
   */
  static async getVoicemailBox(phoneNumber?: string, agentId?: string) {
    try {
      let query = supabaseAdmin
        .from('voicemail_boxes')
        .select('*')
        .eq('is_active', true);

      // First try to find agent-specific box
      if (agentId) {
        const { data: agentBox } = await query.eq('agent_id', agentId).single();
        if (agentBox) return agentBox;
      }

      // Fall back to global box
      const { data: globalBox } = await supabaseAdmin
        .from('voicemail_boxes')
        .select('*')
        .eq('type', 'global')
        .eq('is_active', true)
        .single();

      return globalBox;
    } catch (error) {
      console.error('❌ Failed to get voicemail box:', error);
      return null;
    }
  }

  /**
   * Create a pending voicemail record
   */
  static async createPendingVoicemail(
    callLegId: string,
    fromNumber: string,
    toNumber: string,
    boxId?: string
  ) {
    // Get or create default box if none specified
    if (!boxId) {
      const box = await this.getVoicemailBox();
      boxId = box?.id;
    }

    const { data, error } = await supabaseAdmin
      .from('voicemails')
      .insert({
        box_id: boxId,
        call_leg_id: callLegId,
        call_session_id: callLegId, // Using leg ID as session ID for now
        from_number: fromNumber,
        to_number: toNumber,
        status: 'new',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to create voicemail record:', error);
      throw error;
    }

    log('✅ Created pending voicemail record:', data.id);
    return data;
  }

  /**
   * Handle recording saved webhook
   */
  static async handleRecordingSaved(
    callLegId: string,
    recordingId: string,
    recordingUrl: string,
    durationSeconds: number,
    format: string = 'mp3'
  ) {
    try {
      // Find the voicemail record
      const { data: voicemail, error: findError } = await supabaseAdmin
        .from('voicemails')
        .select('*')
        .eq('call_leg_id', callLegId)
        .single();

      if (findError || !voicemail) {
        console.error('❌ Voicemail record not found for call:', callLegId);
        return;
      }

      // Update with recording information
      const { error: updateError } = await supabaseAdmin
        .from('voicemails')
        .update({
          telnyx_recording_id: recordingId,
          recording_url: recordingUrl,
          recording_url_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
          duration_seconds: durationSeconds,
          format: format,
          updated_at: new Date().toISOString()
        })
        .eq('id', voicemail.id);

      if (updateError) {
        console.error('❌ Failed to update voicemail with recording:', updateError);
        return;
      }

      log('✅ Voicemail recording saved:', voicemail.id);

      // Download and store locally for long-term retention
      await this.downloadAndStoreRecording(voicemail.id, recordingUrl);

      // Send notifications
      await this.sendVoicemailNotifications(voicemail);

    } catch (error) {
      console.error('❌ Error handling recording saved:', error);
    }
  }

  /**
   * Handle transcription saved webhook
   */
  static async handleTranscriptionSaved(
    recordingId: string,
    transcriptionId: string,
    transcript: string,
    confidence?: number
  ) {
    try {
      const { error } = await supabaseAdmin
        .from('voicemails')
        .update({
          transcription_id: transcriptionId,
          transcript: transcript,
          transcription_confidence: confidence,
          updated_at: new Date().toISOString()
        })
        .eq('telnyx_recording_id', recordingId);

      if (error) {
        console.error('❌ Failed to update voicemail with transcription:', error);
        return;
      }

      log('✅ Voicemail transcription saved');
    } catch (error) {
      console.error('❌ Error handling transcription:', error);
    }
  }

  /**
   * Download recording from Telnyx and store locally
   */
  static async downloadAndStoreRecording(voicemailId: string, recordingUrl: string) {
    try {
      // Download the recording
      const response = await fetch(recordingUrl);
      if (!response.ok) {
        throw new Error('Failed to download recording');
      }

      const audioBlob = await response.blob();
      const buffer = Buffer.from(await audioBlob.arrayBuffer());

      // Store in Supabase Storage
      const fileName = `voicemails/${voicemailId}.mp3`;
      const { data, error } = await supabaseAdmin.storage
        .from('recordings')
        .upload(fileName, buffer, {
          contentType: 'audio/mpeg',
          upsert: true
        });

      if (error) {
        console.error('❌ Failed to store recording:', error);
        return;
      }

      // Update voicemail with local path
      await supabaseAdmin
        .from('voicemails')
        .update({
          local_recording_path: fileName,
          file_size_bytes: buffer.length,
          updated_at: new Date().toISOString()
        })
        .eq('id', voicemailId);

      log('✅ Recording stored locally:', fileName);
    } catch (error) {
      console.error('❌ Failed to download and store recording:', error);
    }
  }

  /**
   * Send notifications for new voicemail
   */
  static async sendVoicemailNotifications(voicemail: any) {
    try {
      // Get voicemail box configuration
      const { data: box } = await supabaseAdmin
        .from('voicemail_boxes')
        .select('*')
        .eq('id', voicemail.box_id)
        .single();

      if (!box?.email_notifications) return;

      // TODO: Implement email notifications
      log('📧 Would send voicemail notification to:', box.notification_emails);

      // TODO: Implement real-time notifications via WebSocket/SSE
      log('🔔 Would send real-time notification');

    } catch (error) {
      console.error('❌ Failed to send notifications:', error);
    }
  }

  /**
   * Upload greeting to Telnyx Media Storage
   */
  static async uploadGreeting(
    name: string,
    audioUrl: string,
    ttlSeconds: number = 31536000 // 1 year default
  ) {
    const response = await fetch(
      `${TELNYX_API_URL}/media`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TELNYX_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          media_url: audioUrl,
          media_name: name,
          ttl_secs: ttlSeconds
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Failed to upload greeting:', error);
      throw new Error('Failed to upload greeting to Telnyx');
    }

    const data = await response.json();
    log('✅ Greeting uploaded to Telnyx Media:', name);
    return data;
  }
}
