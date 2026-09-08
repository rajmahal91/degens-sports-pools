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
      id: g.id,
      sport: 'NFL', season: g.season, week: g.week,
      away_team_code: g.awayTeamCode, home_team_code: g.homeTeamCode,
      starts_at: g.startsAt, status: g.status,
      away_score: g.awayScore ?? null, home_score: g.homeScore ?? null,
      external_source: provider.name, external_game_id: g.id, updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('games').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
    return NextResponse.json({ provider: provider.name, synced: rows.length, games: rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Sync failed' }, { status: 500 });
  }
}
