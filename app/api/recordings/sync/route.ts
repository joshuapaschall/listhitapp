import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { TELNYX_API_URL, telnyxHeaders } from '@/lib/telnyx';

// Helper function to fetch recordings from Telnyx API
async function fetchRecordings(params: Record<string, string>) {
  const queryString = new URLSearchParams(params).toString();
  const url = `${TELNYX_API_URL}/recordings?${queryString}`;
  
  const response = await fetch(url, {
    headers: telnyxHeaders()
  });
  
  if (!response.ok) {
    throw new Error(`Telnyx API error: ${response.status}`);
  }
  
  return response.json();
}

export async function POST(request: NextRequest) {
  try {
    const { callSid, force = false } = await request.json();
    
    // Get call details
    const { data: call, error } = await supabaseAdmin
      .from('calls')
      .select('*')
      .eq('call_sid', callSid)
      .single();
    
    if (error || !call) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }
    
    // Skip if already has recording (unless force sync)
    if (call.telnyx_recording_id && !force) {
      return NextResponse.json({
        message: 'Recording already exists',
        recording_id: call.telnyx_recording_id
      });
    }
    
    console.log(`🔍 Searching for recordings for call ${callSid}`);
    
    // Build query parameters for Telnyx API
    const params: Record<string, string> = {
      'page[size]': '50'
    };
    
    // Try searching by call_leg_id first (most precise)
    if (call.call_leg_id || call.telnyx_call_leg_id) {
      params['filter[call_leg_id]'] = call.call_leg_id || call.telnyx_call_leg_id;
      console.log(`🔍 Searching by call_leg_id: ${params['filter[call_leg_id]']}`);
    }
    // Try call_session_id if no leg_id
    else if (call.call_session_id || call.telnyx_call_session_id) {
      params['filter[call_session_id]'] = call.call_session_id || call.telnyx_call_session_id;
      console.log(`🔍 Searching by call_session_id: ${params['filter[call_session_id]']}`);
    }
    // Fallback to time-based search
    else {
      console.log('⚠️ No IDs available, using time-based search');
      const callTime = new Date(call.started_at);
      const after = new Date(callTime.getTime() - 5 * 60 * 1000); // 5 mins before
      const before = new Date(callTime.getTime() + 15 * 60 * 1000); // 15 mins after
      
      params['filter[created_at][gte]'] = after.toISOString();
      params['filter[created_at][lte]'] = before.toISOString();
    }
    
    // Fetch recordings from Telnyx
    const result = await fetchRecordings(params);
    const recordings = result.data || [];
    
    console.log(`📼 Found ${recordings.length} recordings`);
    
    if (recordings.length === 0) {
      return NextResponse.json({
        message: 'No recordings found',
        searched: true,
        params
      });
    }
    
    // Pick the best recording (longest duration if multiple)
    let bestMatch = recordings[0];
    if (recordings.length > 1) {
      bestMatch = recordings.reduce((prev: any, current: any) => 
        (current.duration_millis > prev.duration_millis) ? current : prev
      );
      console.log(`📊 Selected longest recording from ${recordings.length} options`);
    }
    
    console.log(`✅ Using recording ${bestMatch.id}`);
    
    // Update the call record with recording information
    // Store ONLY the recording ID, never URLs (they expire)
    const updateData: any = {
      telnyx_recording_id: bestMatch.id,
      recording_state: 'saved',
      recording_duration_ms: bestMatch.duration_millis || null
    };
    
    // Update IDs from the recording if available
    if (bestMatch.call_session_id) {
      updateData.call_session_id = bestMatch.call_session_id;
      updateData.telnyx_call_session_id = bestMatch.call_session_id;
    }
    if (bestMatch.call_leg_id) {
      updateData.call_leg_id = bestMatch.call_leg_id;
      updateData.telnyx_call_leg_id = bestMatch.call_leg_id;
    }
    if (bestMatch.recording_started_at) {
      updateData.recording_started_at = bestMatch.recording_started_at;
    }
    if (bestMatch.recording_ended_at) {
      updateData.recording_ended_at = bestMatch.recording_ended_at;
    }
    
    const { error: updateError } = await supabaseAdmin
      .from('calls')
      .update(updateData)
      .eq('call_sid', callSid);
    
    if (updateError) {
      console.error('Failed to update call record:', updateError);
      return NextResponse.json(
        { error: 'Failed to update call record' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      recording_id: bestMatch.id,
      duration_ms: bestMatch.duration_millis,
      status: bestMatch.status,
      channels: bestMatch.channels
    });
    
  } catch (error) {
    console.error('Recording sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync recording' },
      { status: 500 }
    );
  }
}

// Batch sync recordings for multiple calls
export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const hoursBack = parseInt(searchParams.get('hours') || '24');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    console.log(`🔄 Batch syncing recordings for last ${hoursBack} hours`);
    
    // Get calls without recordings from the last N hours
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    
    const { data: calls, error } = await supabaseAdmin
      .from('calls')
      .select('*')
      .is('telnyx_recording_id', null)
      .gte('started_at', since.toISOString())
      .eq('status', 'completed')
      .gt('duration', 0)
      .order('started_at', { ascending: false })
      .limit(limit);
    
    if (error || !calls || calls.length === 0) {
      return NextResponse.json({
        message: 'No calls need recording sync',
        checked: 0
      });
    }
    
    console.log(`📞 Found ${calls.length} calls without recordings`);
    
    // Fetch ALL recordings from the time period in one request
    const params: Record<string, string> = {
      'filter[created_at][gte]': since.toISOString(),
      'page[size]': '250' // Max page size
    };
    
    const result = await fetchRecordings(params);
    const allRecordings = result.data || [];
    
    console.log(`📼 Fetched ${allRecordings.length} recordings from Telnyx`);
    
    // Create lookup maps for efficient matching
    const recordingsByLegId = new Map();
    const recordingsBySessionId = new Map();
    
    for (const recording of allRecordings) {
      if (recording.call_leg_id) {
        recordingsByLegId.set(recording.call_leg_id, recording);
      }
      if (recording.call_session_id) {
        if (!recordingsBySessionId.has(recording.call_session_id)) {
          recordingsBySessionId.set(recording.call_session_id, []);
        }
        recordingsBySessionId.get(recording.call_session_id).push(recording);
      }
    }
    
    // Match recordings to calls
    let matched = 0;
    const updates = [];
    
    for (const call of calls) {
      let recording = null;
      
      // Try to match by call_leg_id (most precise)
      if (call.call_leg_id || call.telnyx_call_leg_id) {
        const legId = call.call_leg_id || call.telnyx_call_leg_id;
        recording = recordingsByLegId.get(legId);
      }
      
      // Try to match by call_session_id
      if (!recording && (call.call_session_id || call.telnyx_call_session_id)) {
        const sessionId = call.call_session_id || call.telnyx_call_session_id;
        const sessionRecordings = recordingsBySessionId.get(sessionId) || [];
        if (sessionRecordings.length > 0) {
          // Pick the longest recording from the session
          recording = sessionRecordings.reduce((prev: any, current: any) => 
            (current.duration_millis > prev.duration_millis) ? current : prev
          );
        }
      }
      
      if (recording) {
        matched++;
        updates.push(
          supabaseAdmin
            .from('calls')
            .update({
              telnyx_recording_id: recording.id,
              recording_state: 'saved',
              recording_duration_ms: recording.duration_millis,
              call_session_id: recording.call_session_id,
              telnyx_call_session_id: recording.call_session_id,
              call_leg_id: recording.call_leg_id,
              telnyx_call_leg_id: recording.call_leg_id,
              recording_started_at: recording.recording_started_at,
              recording_ended_at: recording.recording_ended_at
            })
            .eq('call_sid', call.call_sid)
        );
      }
    }
    
    // Execute all updates in parallel
    if (updates.length > 0) {
      await Promise.all(updates);
    }
    
    return NextResponse.json({
      success: true,
      checked: calls.length,
      matched,
      total_recordings: allRecordings.length
    });
    
  } catch (error) {
    console.error('Batch sync error:', error);
    return NextResponse.json(
      { error: 'Failed to batch sync recordings' },
      { status: 500 }
    );
  }
}
