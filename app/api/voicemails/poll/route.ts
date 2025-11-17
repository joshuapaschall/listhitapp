import { NextRequest, NextResponse } from 'next/server';
import { VoicemailPollingService } from '@/services/voicemail-polling-service';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * API endpoint to get voicemails from Telnyx
 * Uses sync endpoint to classify recordings without database writes
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Fetching and classifying recordings...');
    
    // Fetch and classify recordings from Telnyx
    const syncResponse = await fetch(
      new URL('/api/calls/sync-from-telnyx', request.url).toString(),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 7 })
      }
    );
    
    if (!syncResponse.ok) {
      throw new Error('Failed to fetch recordings from Telnyx');
    }
    
    const syncData = await syncResponse.json();
    const { voicemails: classifiedVoicemails } = syncData.data;
    
    console.log(`📊 Found ${syncData.totalRecordings} total recordings, ${classifiedVoicemails.length} voicemails`);
    
    // Format voicemails for the UI
    const formattedRecordings = classifiedVoicemails.map((rec: any) => {
      // Map confidence levels
      let uiConfidence: 'high' | 'medium' | 'low' = 'medium';
      
      if (rec.confidence === 'confirmed') {
        uiConfidence = 'high';
      } else if (rec.source === 'heuristic' && rec.duration < 60) {
        uiConfidence = 'high';
      } else if (rec.source === 'heuristic') {
        uiConfidence = 'medium';
      }
      
      return {
        id: rec.id,
        recording_id: rec.id,
        call_control_id: rec.call_control_id,
        call_session_id: rec.call_session_id,
        duration_millis: rec.duration_millis || 0,
        format: rec.format || 'mp3',
        channels: rec.channels || 'single',
        created_at: rec.created_at,
        updated_at: rec.updated_at,
        download_urls: rec.download_urls || {},
        metadata: {
          from: rec.from || 'Unknown',
          to: rec.to || 'Unknown',
          direction: rec.direction || 'inbound'
        },
        status: rec.status || 'completed',
        type: 'voicemail',
        confidence: uiConfidence,
        source: rec.source // Keep track of how it was classified
      };
    });
    
    // Count by confidence
    const confirmedCount = formattedRecordings.filter((r: any) => r.source === 'database' || r.source === 'api').length;
    const probableCount = formattedRecordings.filter((r: any) => r.source === 'heuristic').length;
    
    return NextResponse.json({
      success: true,
      message: `Found ${formattedRecordings.length} voicemails (${confirmedCount} confirmed, ${probableCount} probable)`,
      voicemails: formattedRecordings,
      stats: {
        total_recordings: syncData.totalRecordings,
        call_recordings: syncData.callRecordings,
        confirmed_voicemails: confirmedCount,
        probable_voicemails: probableCount,
        total_voicemails: formattedRecordings.length
      }
    });
  } catch (error) {
    console.error('Error fetching recordings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recordings' },
      { status: 500 }
    );
  }
}

/**
 * Get voicemails for a specific call
 */
export async function POST(request: NextRequest) {
  try {
    const { callControlId } = await request.json();
    
    if (!callControlId) {
      return NextResponse.json(
        { error: 'callControlId is required' },
        { status: 400 }
      );
    }
    
    const recordings = await VoicemailPollingService.getCallRecordings(callControlId);
    
    return NextResponse.json({
      success: true,
      recordings
    });
  } catch (error) {
    console.error('Error fetching call recordings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recordings' },
      { status: 500 }
    );
  }
}
