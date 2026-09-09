import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getNFLProvider } from '@/lib/sports/provider';

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { season, week, seasonType = 'REG' } = await request.json();
  if (!season || !week) return NextResponse.json({ error: 'season and week are required' }, { status: 400 });
  try {
    const provider = getNFLProvider();
    const games = await provider.gamesByWeek(String(season), Number(week), seasonType);
    const supabase = createAdminClient();
    const rows = games.map(g => ({
      provider_game_id: g.id,
      sport: 'NFL', season: Number(g.season), week: g.week, round_label: `Week ${g.week}`,
      away_team: g.awayTeamCode, home_team: g.homeTeamCode,
      kickoff_at: g.startsAt, status: g.status,
      away_score: g.awayScore ?? null, home_score: g.homeScore ?? null,
      winner_team: g.status==='FINAL'&&g.awayScore!==g.homeScore?(Number(g.awayScore)>Number(g.homeScore)?g.awayTeamCode:g.homeTeamCode):null,
      raw: { provider: provider.name }, updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('games').upsert(rows, { onConflict: 'provider_game_id' });
    if (error) throw error;
    return NextResponse.json({ provider: provider.name, synced: rows.length, games: rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Sync failed' }, { status: 500 });
  }
}
