import { TELNYX_API_URL, getTelnyxApiKey } from "@/lib/voice-env";

/**
 * Voicemail Polling Service - Direct from Telnyx API
 * No database storage - pure API
 */

export class VoicemailPollingService {
  /**
   * Poll Telnyx for all recordings (including voicemails)
   */
  static async pollVoicemails() {
    try {
      const telnyxApiKey = getTelnyxApiKey();
      if (!telnyxApiKey) {
        throw new Error('TELNYX_API_KEY not configured');
      }

      // Get ALL recordings from Telnyx API (last 7 days)
      const response = await fetch(
        `${TELNYX_API_URL}/recordings?` + new URLSearchParams({
          'filter[created_at][gte]': new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last 7 days
          'page[size]': '100',
          'sort': '-created_at'  // Newest first
        }),
        {
          headers: {
            'Authorization': `Bearer ${telnyxApiKey}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch recordings: ${response.statusText}`);
      }

      const { data: recordings } = await response.json();
      console.log(`📬 Found ${recordings?.length || 0} recordings`);

      // Return recordings directly - no database storage
      return recordings || [];
    } catch (error) {
      console.error('Error polling recordings:', error);
      throw error;
    }
  }

  /**
   * Alternative: Get recordings by Call Control ID
   */
  static async getCallRecordings(callControlId: string) {
    try {
      const telnyxApiKey = getTelnyxApiKey();
      
      const response = await fetch(
        `${TELNYX_API_URL}/recordings?filter[call_control_id]=${callControlId}`,
        {
          headers: {
            'Authorization': `Bearer ${telnyxApiKey}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch recordings: ${response.statusText}`);
      }

      const { data } = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching call recordings:', error);
      throw error;
    }
  }

  /**
   * Get a specific recording/voicemail by ID
   */
  static async getRecording(recordingId: string) {
    try {
      const telnyxApiKey = getTelnyxApiKey();
      
      const response = await fetch(
        `${TELNYX_API_URL}/recordings/${recordingId}`,
        {
          headers: {
            'Authorization': `Bearer ${telnyxApiKey}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch recording: ${response.statusText}`);
      }

      const { data } = await response.json();
      
      // The recording object includes:
      // - download_urls: { mp3: "...", wav: "..." }
      // - duration_millis
      // - channels
      // - created_at
      // - updated_at
      // - call_control_id
      // - from / to numbers (in metadata)
      
      return data;
    } catch (error) {
      console.error('Error fetching recording:', error);
      throw error;
    }
  }

  /**
   * Get transcription for a recording
   */
  static async getTranscription(recordingId: string) {
    try {
      const telnyxApiKey = getTelnyxApiKey();
      
      const response = await fetch(
        `${TELNYX_API_URL}/recording_transcriptions?filter[recording_id]=${recordingId}`,
        {
          headers: {
            'Authorization': `Bearer ${telnyxApiKey}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        return null; // Transcription might not be ready yet
      }

      const { data } = await response.json();
      return data[0]?.transcription_text || null;
    } catch (error) {
      console.error('Error fetching transcription:', error);
      return null;
    }
  }

}
