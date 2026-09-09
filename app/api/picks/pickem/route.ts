import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { pickLockAt } from '@/lib/sports/nfl-operations';

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const { entryId, gameId, teamCode } = await request.json();
    if (!entryId || !gameId || !teamCode) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    const { data: entry } = await supabase.from('entries').select('id,user_id,pool_id,payment_status,entry_status').eq('id', entryId).single();
    if (!entry || entry.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (entry.payment_status !== 'PAID' || entry.entry_status !== 'ACTIVE') return NextResponse.json({ error: 'This entry is not eligible to make picks.' }, { status: 403 });
    const { data: game } = await supabase.from('games').select('id,season,week,home_team,away_team,kickoff_at,status').eq('id', gameId).single();
    if (!game || ![game.home_team,game.away_team].includes(teamCode)) return NextResponse.json({ error: 'Invalid team selection.' }, { status: 400 });
    const [{data:pool},{data:weekGames}]=await Promise.all([
      supabase.from('pools').select('scoring_settings').eq('id',entry.pool_id).single(),
      supabase.from('games').select('kickoff_at').eq('sport','NFL').eq('week',game.week).eq('season',game.season),
    ]);
    const lockAt=pickLockAt(game,weekGames||[],pool?.scoring_settings?.deadline_mode||'GAME_KICKOFF');
    if (game.status !== 'SCHEDULED' || lockAt.getTime() <= Date.now()) return NextResponse.json({ error: 'This week is already locked.' }, { status: 400 });
    const { data, error } = await supabase.from('pickem_picks').upsert({ entry_id: entryId, game_id: gameId, selected_team: teamCode }, { onConflict: 'entry_id,game_id' }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ pick: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 401 });
  }
}
