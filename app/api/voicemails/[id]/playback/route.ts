import { NextRequest, NextResponse } from 'next/server';
import { VoicemailService } from '@/services/voicemail-service';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const voicemailId = params.id;
    
    // Get fresh recording URL
    const recordingUrl = await VoicemailService.getFreshRecordingUrl(voicemailId);
    
    if (!recordingUrl) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    // Mark as heard if this is the first playback
    const { data: voicemail } = await supabaseAdmin
      .from('voicemails')
      .select('status')
      .eq('id', voicemailId)
      .single();

    if (voicemail?.status === 'new') {
      // TODO: Get agent ID from session/auth
      await supabaseAdmin
        .from('voicemails')
        .update({
          status: 'heard',
          heard_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', voicemailId);
    }

    // Log playback
    await supabaseAdmin
      .from('voicemail_playback_log')
      .insert({
        voicemail_id: voicemailId,
        // TODO: Get agent ID from session/auth
        // agent_id: agentId,
        played_at: new Date().toISOString(),
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        user_agent: request.headers.get('user-agent')
      });

    // Stream the audio
    const audioResponse = await fetch(recordingUrl);
    
    if (!audioResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch recording' },
        { status: 500 }
      );
    }

    // Return audio with proper headers
    const audioBuffer = await audioResponse.arrayBuffer();
    
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600'
      }
    });

  } catch (error) {
    console.error('Error streaming voicemail:', error);
    return NextResponse.json(
      { error: 'Failed to stream voicemail' },
      { status: 500 }
    );
  }
}
