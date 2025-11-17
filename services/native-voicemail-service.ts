/**
 * Native Telnyx Voicemail Service
 * Uses Telnyx's built-in voicemail feature with minimal webhook handling
 */

import { supabaseAdmin } from "@/lib/supabase";
import { TELNYX_API_URL, getCallControlAppId, getTelnyxApiKey } from "@/lib/voice-env";

interface NativeVoicemailConfig {
  enabled: boolean;
  detectDurationSecs?: number;  // How long to wait before voicemail (default: 25)
  maxDurationSecs?: number;      // Max voicemail length (default: 120)
  afterHoursOnly?: boolean;      // Only enable outside business hours
}

export class NativeVoicemailService {
  /**
   * Enable native voicemail on a phone number
   */
  static async enableVoicemail(
    phoneNumber: string,
    config: NativeVoicemailConfig = { enabled: true }
  ) {
    try {
      const telnyxApiKey = getTelnyxApiKey();
      if (!telnyxApiKey) {
        throw new Error('TELNYX_API_KEY not configured');
      }

      // Update phone number settings via Telnyx API
      const response = await fetch(
        `${TELNYX_API_URL}/phone_numbers/${phoneNumber}/voice`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${telnyxApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            call_forwarding: {
              forwarding_type: config.enabled ? 'on_failure' : 'disabled',
              forwards_to: 'voicemail',
              failure_reasons: ['timeout', 'unreachable'],
              timeout_secs: config.detectDurationSecs || 25
            },
            voicemail: {
              enabled: config.enabled,
              max_message_length_secs: config.maxDurationSecs || 120,
              greeting_type: 'default',  // Use Telnyx default greeting
              transcription_enabled: true,
              transcription_provider: 'telnyx',  // Cheaper than Google
              send_email_on_new_message: false  // We handle notifications ourselves
            }
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to configure voicemail: ${JSON.stringify(error)}`);
      }

      const result = await response.json();
      console.log(`✅ Native voicemail ${config.enabled ? 'enabled' : 'disabled'} for ${phoneNumber}`);
      
      // Store configuration in database
      await supabaseAdmin
        .from('phone_number_settings')
        .upsert({
          phone_number: phoneNumber,
          voicemail_enabled: config.enabled,
          voicemail_timeout_secs: config.detectDurationSecs || 25,
          voicemail_max_length_secs: config.maxDurationSecs || 120,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'phone_number'
        });

      return result;
    } catch (error) {
      console.error('Error enabling native voicemail:', error);
      throw error;
    }
  }

  /**
   * Handle native voicemail webhook event
   * Much simpler than custom implementation - just store the voicemail
   */
  static async handleVoicemailWebhook(payload: any) {
    try {
      const {
        call_control_id,
        from,
        to,
        recording_url,
        duration_secs,
        transcription_text,
        occurred_at
      } = payload.data.payload;

      console.log('📬 Native voicemail received:', {
        from,
        to,
        duration: duration_secs,
        hasTranscription: !!transcription_text
      });

      // Store voicemail in simplified table
      const { data: voicemail, error } = await supabaseAdmin
        .from('native_voicemails')
        .insert({
          call_control_id,
          from_number: from,
          to_number: to,
          recording_url,  // This URL is permanent from Telnyx
          duration_seconds: duration_secs,
          transcript: transcription_text,
          status: 'new',
          received_at: occurred_at || new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error storing native voicemail:', error);
        throw error;
      }

      // Try to match with buyer
      const { data: buyer } = await supabaseAdmin
        .from('buyers')
        .select('id, name')
        .or(`phone.eq.${from},phone2.eq.${from},phone3.eq.${from}`)
        .single();

      if (buyer) {
        await supabaseAdmin
          .from('native_voicemails')
          .update({ buyer_id: buyer.id })
          .eq('id', voicemail.id);
        
        console.log(`📎 Voicemail linked to buyer: ${buyer.name}`);
      }

      // TODO: Send notifications (email, SMS, etc.)
      // await NotificationService.notifyNewVoicemail(voicemail);

      return voicemail;
    } catch (error) {
      console.error('Error handling native voicemail webhook:', error);
      throw error;
    }
  }

  /**
   * List phone numbers with voicemail status
   */
  static async listPhoneNumbers() {
    try {
      const telnyxApiKey = getTelnyxApiKey();
      if (!telnyxApiKey) {
        throw new Error('TELNYX_API_KEY not configured');
      }

      const callControlAppId = getCallControlAppId();

      if (!callControlAppId) {
        throw new Error('Missing Call Control App ID');
      }

      const response = await fetch(
        `${TELNYX_API_URL}/phone_numbers?filter[connection_id]=${callControlAppId}`,
        {
          headers: {
            'Authorization': `Bearer ${telnyxApiKey}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch phone numbers');
      }

      const { data } = await response.json();
      
      // Check voicemail status for each number
      const numbersWithStatus = await Promise.all(
        data.map(async (number: any) => {
          const { data: settings } = await supabaseAdmin
            .from('phone_number_settings')
            .select('voicemail_enabled, voicemail_timeout_secs')
            .eq('phone_number', number.phone_number)
            .single();

          return {
            phone_number: number.phone_number,
            voicemail_enabled: settings?.voicemail_enabled || false,
            timeout_secs: settings?.voicemail_timeout_secs || 25
          };
        })
      );

      return numbersWithStatus;
    } catch (error) {
      console.error('Error listing phone numbers:', error);
      throw error;
    }
  }

  /**
   * Get voicemail statistics
   */
  static async getStats(dateRange?: { start: string; end: string }) {
    try {
      let query = supabaseAdmin
        .from('native_voicemails')
        .select('status, duration_seconds', { count: 'exact' });

      if (dateRange) {
        query = query
          .gte('received_at', dateRange.start)
          .lte('received_at', dateRange.end);
      }

      const { data, count } = await query;

      if (!data) return null;

      const stats = {
        total: count || 0,
        new: data.filter(v => v.status === 'new').length,
        heard: data.filter(v => v.status === 'heard').length,
        saved: data.filter(v => v.status === 'saved').length,
        avgDuration: data.length > 0 
          ? Math.round(data.reduce((sum, v) => sum + (v.duration_seconds || 0), 0) / data.length)
          : 0
      };

      return stats;
    } catch (error) {
      console.error('Error getting voicemail stats:', error);
      throw error;
    }
  }
}
