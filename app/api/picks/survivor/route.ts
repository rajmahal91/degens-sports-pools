import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = await request.json();
    const { entryId, roundId, teamCode } = body;
    if (!entryId || !roundId || !teamCode) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    const { data: entry } = await supabase.from('entries').select('id,user_id').eq('id', entryId).single();
    if (!entry || entry.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { data, error } = await supabase.from('survivor_picks').upsert({ entry_id: entryId, round_id: roundId, team_code: teamCode }, { onConflict: 'entry_id,round_id' }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ pick: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 401 });
  }
}
