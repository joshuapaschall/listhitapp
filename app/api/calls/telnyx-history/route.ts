export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx";

// Types based on Telnyx API documentation

interface TelnyxCallEvent {
  name: string; // call.initiated, call.answered, call.hangup, etc.
  event_timestamp: string;
  call_session_id?: string;
  application_session_id?: string;
  call_leg_id?: string;
  type: 'webhook' | 'command';
  metadata?: any;
  from?: string;
  to?: string;
  direction?: string;
  hangup_cause?: string;
  hangup_source?: string;
}

interface TelnyxRecording {
  id: string; // recording_id
  call_session_id: string;
  call_leg_id: string;
  call_control_id: string;
  channels: 'single' | 'dual';
  duration_millis: number;
  download_urls: {
    mp3?: string;
    wav?: string;
  };
  recording_started_at: string;
  recording_ended_at: string;
  status: 'pending' | 'completed' | 'failed';
  from?: string;
  to?: string;
  source?: 'call' | 'conference';
}

interface CallSession {
  call_session_id: string;
  from: string;
  to: string;
  direction: 'A_to_B' | 'B_to_A' | 'unknown';
  started_at: string;
  answered_at?: string;
  ended_at?: string;
  hangup_cause?: string;
  legs: string[];
  recordings: Array<{
    recording_id: string;
    channels: 'single' | 'dual';
    format: string[];
    duration_ms: number;
    recording_started_at: string;
    recording_ended_at: string;
    download_urls: {
      mp3?: string;
      wav?: string;
    };
  }>;
}

// Helper to paginate through Telnyx API results
async function paginateTelnyx<T>(
  endpoint: string, 
  params: Record<string, string>,
  maxPages = 10
): Promise<T[]> {
  const results: T[] = [];
  let pageNumber = 1;
  let hasMore = true;
  
  while (hasMore && pageNumber <= maxPages) {
    const queryParams = { ...params, 'page[number]': pageNumber.toString() };
    const queryString = new URLSearchParams(queryParams).toString();
    const url = `${TELNYX_API_URL}${endpoint}?${queryString}`;
    
    const response = await fetch(url, { headers: telnyxHeaders() });
    
    if (!response.ok) {
      if (response.status === 429) {
        // Rate limited - wait and retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      throw new Error(`Telnyx API error: ${response.status}`);
    }
    
    const json = await response.json();
    const data = json.data || [];
    results.push(...data);
    
    // Check if there are more pages
    const meta = json.meta;
    hasMore = meta && pageNumber < meta.total_pages;
    pageNumber++;
  }
  
  return results;
}

// Determine call direction based on phone numbers
function inferDirection(from: string, to: string, phoneA: string, phoneB: string): 'A_to_B' | 'B_to_A' | 'unknown' {
  const normalizePhone = (phone: string) => phone.replace(/\D/g, '');
  const fromNorm = normalizePhone(from);
  const toNorm = normalizePhone(to);
  const aNorm = normalizePhone(phoneA);
  const bNorm = normalizePhone(phoneB);
  
  if (fromNorm.includes(aNorm) && toNorm.includes(bNorm)) return 'A_to_B';
  if (fromNorm.includes(bNorm) && toNorm.includes(aNorm)) return 'B_to_A';
  return 'unknown';
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Required parameters
    const phoneA = searchParams.get('phoneA');
    const phoneB = searchParams.get('phoneB');
    const startISO = searchParams.get('dateFrom') || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const endISO = searchParams.get('dateTo') || new Date().toISOString();
    const connectionId = searchParams.get('connectionId'); // Optional
    
    if (!phoneA || !phoneB) {
      return NextResponse.json(
        { error: 'phoneA and phoneB are required (E.164 format)' },
        { status: 400 }
      );
    }
    
    // Ensure E.164 format
    const formatE164 = (phone: string) => {
      const cleaned = phone.replace(/\D/g, '');
      return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
    };
    
    const A_E164 = formatE164(phoneA);
    const B_E164 = formatE164(phoneB);
    
    console.log(`📞 Fetching calls between ${A_E164} and ${B_E164}`);
    console.log(`📅 Date range: ${startISO} to ${endISO}`);
    
    // Step 1: Pull recordings for both directions
    const recordingParams = {
      'filter[created_at][gte]': startISO,
      'filter[created_at][lte]': endISO,
      'page[size]': '250'
    };
    
    if (connectionId) {
      recordingParams['filter[connection_id]'] = connectionId;
    }
    
    const [recordingsAtoB, recordingsBtoA] = await Promise.all([
      // A → B recordings
      paginateTelnyx<TelnyxRecording>('/recordings', {
        ...recordingParams,
        'filter[from]': A_E164,
        'filter[to]': B_E164
      }),
      // B → A recordings  
      paginateTelnyx<TelnyxRecording>('/recordings', {
        ...recordingParams,
        'filter[from]': B_E164,
        'filter[to]': A_E164
      })
    ]);
    
    const allRecordings = [...recordingsAtoB, ...recordingsBtoA];
    console.log(`🎙️ Found ${allRecordings.length} recordings`);
    
    // Step 2: Index recordings by call_session_id
    const sessionBuckets = new Map<string, {
      recordings: any[];
      sampleFrom?: string;
      sampleTo?: string;
    }>();
    
    for (const rec of allRecordings) {
      const sessionId = rec.call_session_id;
      if (!sessionId) continue;
      
      if (!sessionBuckets.has(sessionId)) {
        sessionBuckets.set(sessionId, {
          recordings: [],
          sampleFrom: rec.from,
          sampleTo: rec.to
        });
      }
      
      const bucket = sessionBuckets.get(sessionId)!;
      bucket.recordings.push({
        recording_id: rec.id,
        channels: rec.channels,
        format: Object.keys(rec.download_urls || {}), // ['mp3', 'wav']
        duration_ms: rec.duration_millis,
        recording_started_at: rec.recording_started_at,
        recording_ended_at: rec.recording_ended_at,
        download_urls: rec.download_urls,
        call_leg_id: rec.call_leg_id,
        call_control_id: rec.call_control_id
      });
    }
    
    console.log(`📊 Found ${sessionBuckets.size} unique call sessions with recordings`);
    
    // Step 3: For each session, fetch call events to compute call metadata
    const results: CallSession[] = [];
    
    for (const [sessionId, bucket] of sessionBuckets) {
      try {
        // Fetch call events for this specific session
        // This avoids the 24-hour limitation when filtering by numbers only
        const events = await paginateTelnyx<TelnyxCallEvent>('/call_events', {
          'filter[application_session_id]': sessionId,
          'page[size]': '250'
        });
        
        // Sort events by timestamp
        events.sort((a, b) => 
          new Date(a.event_timestamp).getTime() - new Date(b.event_timestamp).getTime()
        );
        
        // Extract call metadata from events
        let started_at = '';
        let answered_at: string | undefined;
        let ended_at: string | undefined;
        let hangup_cause: string | undefined;
        const legs = new Set<string>();
        
        for (const event of events) {
          // Track unique legs
          if (event.call_leg_id) {
            legs.add(event.call_leg_id);
          }
          
          // Process event types
          switch (event.name) {
            case 'call.initiated':
            case 'call.init.received':
              if (!started_at || new Date(event.event_timestamp) < new Date(started_at)) {
                started_at = event.event_timestamp;
              }
              break;
            case 'call.answered':
              answered_at = event.event_timestamp;
              break;
            case 'call.hangup':
              ended_at = event.event_timestamp;
              hangup_cause = event.hangup_cause || event.metadata?.hangup_cause || 'normal_clearing';
              break;
          }
        }
        
        // If no events found, use recording timestamps as fallback
        if (!started_at && bucket.recordings.length > 0) {
          started_at = bucket.recordings[0].recording_started_at;
          ended_at = bucket.recordings[bucket.recordings.length - 1].recording_ended_at;
        }
        
        // Build the call session object
        results.push({
          call_session_id: sessionId,
          from: bucket.sampleFrom || '',
          to: bucket.sampleTo || '',
          direction: inferDirection(
            bucket.sampleFrom || '', 
            bucket.sampleTo || '', 
            A_E164, 
            B_E164
          ),
          started_at,
          answered_at,
          ended_at,
          hangup_cause,
          legs: Array.from(legs),
          recordings: bucket.recordings.sort((a, b) => 
            new Date(a.recording_started_at).getTime() - 
            new Date(b.recording_started_at).getTime()
          )
        });
        
      } catch (error) {
        console.error(`Failed to fetch events for session ${sessionId}:`, error);
        
        // Fallback: create session from recording data only
        const firstRec = bucket.recordings[0];
        if (firstRec) {
          results.push({
            call_session_id: sessionId,
            from: bucket.sampleFrom || '',
            to: bucket.sampleTo || '',
            direction: inferDirection(
              bucket.sampleFrom || '', 
              bucket.sampleTo || '', 
              A_E164, 
              B_E164
            ),
            started_at: firstRec.recording_started_at,
            ended_at: bucket.recordings[bucket.recordings.length - 1].recording_ended_at,
            legs: [firstRec.call_leg_id],
            recordings: bucket.recordings
          });
        }
      }
    }
    
    // Step 4 (Optional): Add calls without recordings
    // This would require fetching call_events by numbers (limited to 24h)
    // Skipping for now as recordings are the primary focus
    
    // Sort results by started_at (most recent first)
    results.sort((a, b) => 
      new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    );
    
    console.log(`✅ Returning ${results.length} call sessions with recordings`);
    
    return NextResponse.json({
      success: true,
      phoneA: A_E164,
      phoneB: B_E164,
      startISO,
      endISO,
      total_sessions: results.length,
      total_recordings: allRecordings.length,
      calls: results
    });
    
  } catch (error) {
    console.error('❌ Error fetching Telnyx history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch call history' },
      { status: 500 }
    );
  }
}
