export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const search = searchParams.get('search') || '';
    const agentId = searchParams.get('agentId') || '';
    const buyerId = searchParams.get('buyerId') || '';
    const direction = searchParams.get('direction') || '';
    const hasRecording = searchParams.get('hasRecording') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const sortBy = searchParams.get('sortBy') || 'started_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build query
    let query = supabaseAdmin
      .from('calls')
      .select(`
        *,
        telnyx_recording_id,
        recording_confidence,
        from_agent:agents!calls_from_agent_id_fkey(
          id,
          email,
          display_name
        ),
        buyer:buyers(
          id,
          fname,
          lname,
          phone
        )
      `, { count: 'exact' });

    // Apply filters
    if (search) {
      // Search in phone numbers
      query = query.or(`from_number.ilike.%${search}%,to_number.ilike.%${search}%`);
    }

    if (agentId) {
      query = query.eq('from_agent_id', agentId);
    }

    if (buyerId) {
      query = query.eq('buyer_id', buyerId);
    }

    if (direction) {
      query = query.eq('direction', direction);
    }

    if (hasRecording === 'true') {
      query = query.or('recording_url.not.is.null,telnyx_recording_id.not.is.null');
    } else if (hasRecording === 'false') {
      query = query.is('recording_url', null).is('telnyx_recording_id', null);
    }

    if (dateFrom) {
      query = query.gte('started_at', dateFrom);
    }

    if (dateTo) {
      // Add one day to include the entire end date
      const endDate = new Date(dateTo);
      endDate.setDate(endDate.getDate() + 1);
      query = query.lt('started_at', endDate.toISOString());
    }

    // Apply sorting
    const orderColumn = sortBy === 'agent' ? 'from_agent_id' : sortBy;
    query = query.order(orderColumn, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;
    query = query.range(start, end);

    // Execute query
    const { data: calls, error, count } = await query;

    if (error) {
      console.error('Error fetching calls:', error);
      return NextResponse.json(
        { error: 'Failed to fetch calls' },
        { status: 500 }
      );
    }

    // Trigger background sync for recent calls without recordings
    // This is non-blocking to keep the response fast
    if (calls && calls.length > 0) {
      const callsWithoutRecordings = calls.filter(call => 
        !call.telnyx_recording_id && 
        call.call_sid && 
        call.status === 'completed' &&
        call.duration && call.duration > 0 &&
        // Only check calls from last 48 hours
        new Date(call.started_at) > new Date(Date.now() - 48 * 60 * 60 * 1000)
      );
      
      if (callsWithoutRecordings.length > 0) {
        console.log(`🔍 ${callsWithoutRecordings.length} calls need recording sync`);
        
        // Trigger async sync for each call (non-blocking)
        // We'll fetch recordings on next page load
        callsWithoutRecordings.forEach(call => {
          fetch(`${request.nextUrl.origin}/api/recordings/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callSid: call.call_sid })
          }).catch(() => console.log(`⚠️ Sync trigger failed for ${call.call_sid}`));
        });
      }
    }

    // Format response with pagination metadata
    const totalPages = count ? Math.ceil(count / pageSize) : 0;
    
    return NextResponse.json({
      calls: calls || [],
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Call history error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
