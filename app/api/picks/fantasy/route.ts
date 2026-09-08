import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

const validSlots = new Set(['QB','RB1','RB2','WR1','WR2','TE']);

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const { entryId, roundId, slot, athleteId } = await request.json();
    if (!entryId || !roundId || !slot || !athleteId || !validSlots.has(slot)) return NextResponse.json({ error: 'Invalid lineup selection' }, { status: 400 });
    const { data: entry } = await supabase.from('entries').select('id,user_id').eq('id', entryId).single();
    if (!entry || entry.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { data, error } = await supabase.from('playoff_fantasy_picks').upsert({ entry_id: entryId, round_id: roundId, slot, athlete_id: athleteId }, { onConflict: 'entry_id,round_id,slot' }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ pick: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 401 });
  }
}
