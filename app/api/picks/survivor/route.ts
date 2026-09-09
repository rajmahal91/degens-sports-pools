import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = await request.json();
    const { entryId, gameId, week, teamCode } = body;
    if (!entryId || !gameId || !week || !teamCode) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    const { data: entry } = await supabase.from('entries').select('id,user_id,payment_status,entry_status').eq('id', entryId).single();
    if (!entry || entry.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (entry.payment_status !== 'PAID' || entry.entry_status !== 'ACTIVE') return NextResponse.json({ error: 'This entry is not eligible to make a pick.' }, { status: 403 });
    const { data: game } = await supabase.from('games').select('id,week,home_team,away_team,kickoff_at,status').eq('id', gameId).single();
    if (!game || game.week !== Number(week) || ![game.home_team,game.away_team].includes(teamCode)) return NextResponse.json({ error: 'Invalid team selection.' }, { status: 400 });
    if (game.status !== 'SCHEDULED' || new Date(game.kickoff_at).getTime() <= Date.now()) return NextResponse.json({ error: 'This game is already locked.' }, { status: 400 });
    const { data: used, error: usedError } = await supabase.from('survivor_picks').select('id,week').eq('entry_id',entryId).eq('team_code',teamCode).neq('week',Number(week)).limit(1);
    if (usedError) return NextResponse.json({ error: usedError.message }, { status: 400 });
    if (used?.length) return NextResponse.json({ error: `${teamCode} was already used in Week ${used[0].week}.` }, { status: 400 });
    const { data, error } = await supabase.from('survivor_picks').upsert({ entry_id: entryId, game_id: gameId, week: Number(week), team_code: teamCode }, { onConflict: 'entry_id,week' }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ pick: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 401 });
  }
}
