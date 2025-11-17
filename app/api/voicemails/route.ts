import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const agentId = searchParams.get('agent_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabaseAdmin
      .from('voicemails')
      .select(`
        *,
        voicemail_boxes (
          type,
          agent_id,
          queue_id
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    
    if (agentId) {
      query = query.or(`assigned_to.eq.${agentId},voicemail_boxes.agent_id.eq.${agentId}`);
    }

    // Exclude soft-deleted
    query = query.is('deleted_at', null);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching voicemails:', error);
      return NextResponse.json(
        { error: 'Failed to fetch voicemails' },
        { status: 500 }
      );
    }

    // Get statistics
    const { data: stats } = await supabaseAdmin
      .rpc('get_voicemail_stats', { p_agent_id: agentId });

    return NextResponse.json({
      voicemails: data,
      total: count,
      stats: stats?.[0] || {
        total_count: 0,
        new_count: 0,
        heard_count: 0,
        saved_count: 0,
        avg_duration_seconds: 0
      }
    });

  } catch (error) {
    console.error('Error in voicemails API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Update voicemail status/assignment
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { voicemailId, status, assignedTo, notes, priority, tags } = body;

    if (!voicemailId) {
      return NextResponse.json(
        { error: 'Voicemail ID is required' },
        { status: 400 }
      );
    }

    const updates: any = {
      updated_at: new Date().toISOString()
    };

    if (status) updates.status = status;
    if (assignedTo !== undefined) updates.assigned_to = assignedTo;
    if (notes !== undefined) updates.notes = notes;
    if (priority) updates.priority = priority;
    if (tags) updates.tags = tags;

    const { data, error } = await supabaseAdmin
      .from('voicemails')
      .update(updates)
      .eq('id', voicemailId)
      .select()
      .single();

    if (error) {
      console.error('Error updating voicemail:', error);
      return NextResponse.json(
        { error: 'Failed to update voicemail' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error updating voicemail:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Soft delete voicemail
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const voicemailId = searchParams.get('id');

    if (!voicemailId) {
      return NextResponse.json(
        { error: 'Voicemail ID is required' },
        { status: 400 }
      );
    }

    // Soft delete
    const { error } = await supabaseAdmin
      .from('voicemails')
      .update({
        deleted_at: new Date().toISOString(),
        status: 'deleted',
        // TODO: Get agent ID from session/auth
        // deleted_by: agentId
      })
      .eq('id', voicemailId);

    if (error) {
      console.error('Error deleting voicemail:', error);
      return NextResponse.json(
        { error: 'Failed to delete voicemail' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting voicemail:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
