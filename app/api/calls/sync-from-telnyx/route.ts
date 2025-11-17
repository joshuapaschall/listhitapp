import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { TELNYX_API_URL, telnyxHeaders } from '@/lib/telnyx';

interface TelnyxCallEvent {
  name: string;
  event_timestamp: string;
  call_session_id?: string;
  call_leg_id?: string;
  from?: string;
  to?: string;
  direction?: string;
  hangup_cause?: string;
  hangup_source?: string;
}

interface TelnyxRecording {
  id: string;
  call_session_id?: string;
  call_leg_id?: string;
  channels: 'single' | 'dual';
  duration_millis: number;
  from?: string;
  to?: string;
  created_at: string;
  status: string;
}

/**
 * Fetch and classify recordings from Telnyx API
 * Returns classified recordings without database updates
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Fetching recordings from Telnyx...');
    
    // Get date range (default: last 7 days)
    const body = await request.json().catch(() => ({}));
    const daysBack = body.days || 7;
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    const endDate = new Date();
    
    // Step 1: Fetch all recordings from Telnyx
    const recordingsResponse = await fetch(
      `${TELNYX_API_URL}/recordings?` + new URLSearchParams({
        'filter[created_at][gte]': startDate.toISOString(),
        'filter[created_at][lte]': endDate.toISOString(),
        'page[size]': '250',
        'sort': '-created_at'
      }),
      { headers: telnyxHeaders() }
    );
    
    if (!recordingsResponse.ok) {
      throw new Error(`Telnyx API error: ${recordingsResponse.status}`);
    }
    
    const { data: recordings } = await recordingsResponse.json();
    console.log(`📼 Found ${recordings.length} recordings from Telnyx`);
    
    // Step 2: Get existing call recording IDs from database (for classification)
    const { data: existingCalls } = await supabaseAdmin
      .from('calls')
      .select('recording_id, status')
      .not('recording_id', 'is', null);
    
    const knownCallRecordingIds = new Set(
      existingCalls?.filter(c => c.status !== 'voicemail').map(c => c.recording_id) || []
    );
    const knownVoicemailIds = new Set(
      existingCalls?.filter(c => c.status === 'voicemail').map(c => c.recording_id) || []
    );
    
    console.log(`📊 Found ${knownCallRecordingIds.size} call recordings and ${knownVoicemailIds.size} voicemails in database`);
    
    // Step 3: Classify recordings
    const callRecordings = [];
    const voicemails = [];
    
    for (const recording of recordings) {
      // If we already know this is a call recording
      if (knownCallRecordingIds.has(recording.id)) {
        callRecordings.push({
          ...recording,
          confidence: 'confirmed',
          source: 'database'
        });
        continue;
      }
      
      // If we already know this is a voicemail
      if (knownVoicemailIds.has(recording.id)) {
        voicemails.push({
          ...recording,
          confidence: 'confirmed',
          source: 'database'
        });
        continue;
      }
      
      // For unknown recordings, check if they were answered
      let wasAnswered = false;
      let confidence = 'probable';
      
      if (recording.call_session_id) {
        try {
          const eventsResponse = await fetch(
            `${TELNYX_API_URL}/call_events?` + new URLSearchParams({
              'filter[call_session_id]': recording.call_session_id,
              'page[size]': '100'
            }),
            { headers: telnyxHeaders() }
          );
          
          if (eventsResponse.ok) {
            const { data: events } = await eventsResponse.json();
            
            // Check for answered event
            wasAnswered = events.some((e: TelnyxCallEvent) => e.name === 'call.answered');
            confidence = 'confirmed'; // We have event data
          }
        } catch (error) {
          console.warn(`Could not fetch events for session ${recording.call_session_id}`);
          // Fall back to heuristics
        }
      }
      
      // Apply heuristics if we couldn't get events
      if (confidence === 'probable') {
        // Single channel + short duration = likely voicemail
        const duration = Math.round((recording.duration_millis || 0) / 1000);
        if (recording.channels === 'single' && duration < 90) {
          voicemails.push({
            ...recording,
            confidence,
            source: 'heuristic',
            duration
          });
        } else {
          callRecordings.push({
            ...recording,
            confidence,
            source: 'heuristic',
            duration
          });
        }
      } else {
        // We have event data
        const isVoicemail = !wasAnswered && recording.channels === 'single';
        
        if (isVoicemail) {
          voicemails.push({
            ...recording,
            confidence,
            source: 'api',
            wasAnswered
          });
        } else {
          callRecordings.push({
            ...recording,
            confidence,
            source: 'api',
            wasAnswered
          });
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      totalRecordings: recordings.length,
      callRecordings: callRecordings.length,
      voicemails: voicemails.length,
      data: {
        callRecordings,
        voicemails
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching recordings from Telnyx:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recordings from Telnyx' },
      { status: 500 }
    );
  }
}
