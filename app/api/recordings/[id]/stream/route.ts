import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { TELNYX_API_URL, telnyxHeaders } from '@/lib/telnyx';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Recording ID is required' },
        { status: 400 }
      );
    }
    
    console.log('🎵 Fetching recording:', id);
    
    // Determine if this is a recording ID or call_sid
    let telnyxRecordingId: string;
    
    // Check if it's a UUID (recording ID)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    if (isUUID) {
      telnyxRecordingId = id;
    } else {
      // It's a call_sid, lookup the recording ID
      const { data: call, error } = await supabaseAdmin
        .from('calls')
        .select('telnyx_recording_id')
        .eq('call_sid', id)
        .single();
      
      if (error || !call?.telnyx_recording_id) {
        return NextResponse.json(
          { error: 'No recording found for this call' },
          { status: 404 }
        );
      }
      
      telnyxRecordingId = call.telnyx_recording_id;
    }
    
    // Fetch recording details from Telnyx API
    const recordingResponse = await fetch(
      `${TELNYX_API_URL}/recordings/${telnyxRecordingId}`,
      {
        headers: telnyxHeaders()
      }
    );
    
    if (!recordingResponse.ok) {
      console.error('❌ Failed to fetch recording:', recordingResponse.status);
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }
    
    const recording = await recordingResponse.json();
    const recordingData = recording.data;
    
    // Get the download URL (prefer MP3 for compatibility)
    const downloadUrl = recordingData.download_urls?.mp3 || 
                       recordingData.download_urls?.wav;
    
    if (!downloadUrl) {
      return NextResponse.json(
        { error: 'No download URL available' },
        { status: 404 }
      );
    }
    
    console.log('✅ Got recording URL, fetching audio...');
    
    // Fetch the actual audio file
    const audioResponse = await fetch(downloadUrl);
    
    if (!audioResponse.ok) {
      console.error('❌ Failed to fetch audio:', audioResponse.status);
      
      // If URL expired, try once more
      if (audioResponse.status === 403) {
        console.log('🔄 URL expired, retrying...');
        
        // Fetch fresh URL
        const retryRecordingResponse = await fetch(
          `${TELNYX_API_URL}/recordings/${telnyxRecordingId}`,
          {
            headers: telnyxHeaders()
          }
        );
        
        if (retryRecordingResponse.ok) {
          const retryRecording = await retryRecordingResponse.json();
          const retryUrl = retryRecording.data.download_urls?.mp3 || 
                          retryRecording.data.download_urls?.wav;
          
          if (retryUrl) {
            const retryAudioResponse = await fetch(retryUrl);
            if (retryAudioResponse.ok) {
              const audioBuffer = await retryAudioResponse.arrayBuffer();
              return new NextResponse(audioBuffer, {
                status: 200,
                headers: {
                  'Content-Type': 'audio/mpeg',
                  'Content-Length': audioBuffer.byteLength.toString(),
                  'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
                },
              });
            }
          }
        }
      }
      
      return NextResponse.json(
        { error: 'Failed to fetch recording' },
        { status: 500 }
      );
    }
    
    // Stream the audio back to the client
    const audioBuffer = await audioResponse.arrayBuffer();
    
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
    
  } catch (error) {
    console.error('❌ Recording stream error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Support HEAD requests for audio preload
export async function HEAD(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Return basic headers without fetching the actual recording
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=300' // Cache for 5 minutes
    }
  });
}
