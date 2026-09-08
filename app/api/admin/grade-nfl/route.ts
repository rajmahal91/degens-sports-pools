import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getNFLProvider } from '@/lib/sports/provider';
import { calculateFantasyPoints, DEFAULT_HALF_PPR } from '@/lib/sports/fantasy';

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return !!secret && request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { season, week, seasonType = 'REG' } = await request.json();
  if (!season || !week) return NextResponse.json({ error: 'season and week are required' }, { status: 400 });

  try {
    const supabase = createAdminClient();
    const provider = getNFLProvider();
    const games = await provider.gamesByWeek(String(season), Number(week), seasonType);
    const finalGames = games.filter(g => g.status === 'FINAL' && g.awayScore != null && g.homeScore != null);
    const gameRows = finalGames.map(g => ({ id: g.id, sport: 'NFL', season: g.season, week: g.week, away_team_code: g.awayTeamCode, home_team_code: g.homeTeamCode, starts_at: g.startsAt, status: g.status, away_score: g.awayScore, home_score: g.homeScore, external_source: provider.name, external_game_id: g.id, updated_at: new Date().toISOString() }));
    if (gameRows.length) await supabase.from('games').upsert(gameRows, { onConflict: 'id' });

    let pickemGraded = 0;
    for (const g of finalGames) {
      if (g.awayScore === g.homeScore) continue;
      const winner = g.awayScore! > g.homeScore! ? g.awayTeamCode : g.homeTeamCode;
      const { data: picks } = await supabase.from('pickem_picks').select('id,team_code').eq('game_id', g.id);
      for (const pick of picks || []) {
        await supabase.from('pickem_picks').update({ is_correct: pick.team_code === winner, locked_at: g.startsAt }).eq('id', pick.id);
        pickemGraded++;
      }
    }

    let survivorGraded = 0;
    const { data: rounds } = await supabase.from('rounds').select('id,pool_id,sequence').eq('sequence', Number(week));
    for (const round of rounds || []) {
      const { data: pool } = await supabase.from('pools').select('sport,contest_type,season').eq('id', round.pool_id).single();
      if (!pool || pool.sport !== 'NFL' || pool.contest_type !== 'SURVIVOR' || pool.season !== String(season)) continue;
      const { data: picks } = await supabase.from('survivor_picks').select('id,entry_id,team_code').eq('round_id', round.id);
      for (const pick of picks || []) {
        const game = finalGames.find(g => [g.homeTeamCode, g.awayTeamCode].includes(pick.team_code));
        if (!game || game.awayScore === game.homeScore) continue;
        const winner = game.awayScore! > game.homeScore! ? game.awayTeamCode : game.homeTeamCode;
        const result = pick.team_code === winner ? 'WIN' : 'LOSS';
        await supabase.from('survivor_picks').update({ result, locked_at: game.startsAt }).eq('id', pick.id);
        if (result === 'LOSS') await supabase.from('entries').update({ status: 'ELIMINATED' }).eq('id', pick.entry_id);
        survivorGraded++;
      }
    }

    let fantasyGraded = 0;
    if (seasonType === 'POST') {
      const stats = await provider.playerStatsByWeek(String(season), Number(week), 'POST');
      const statMap = new Map(stats.map(s => [s.athleteId, s]));
      const { data: fantasyRounds } = await supabase.from('rounds').select('id,pool_id,sequence').eq('sequence', Number(week));
      for (const round of fantasyRounds || []) {
        const { data: pool } = await supabase.from('pools').select('sport,contest_type,season,settings').eq('id', round.pool_id).single();
        if (!pool || pool.sport !== 'NFL' || pool.contest_type !== 'PLAYOFF_FANTASY' || pool.season !== String(season)) continue;
        const cfg = { ...DEFAULT_HALF_PPR, ...(pool.settings?.scoring || {}) };
        const { data: picks } = await supabase.from('playoff_fantasy_picks').select('id,athlete_id').eq('round_id', round.id);
        for (const pick of picks || []) {
          const stat = statMap.get(String(pick.athlete_id));
          if (!stat) continue;
          const points = calculateFantasyPoints(stat, cfg);
          await supabase.from('playoff_fantasy_picks').update({ fantasy_points: points }).eq('id', pick.id);
          fantasyGraded++;
        }
      }
    }

    return NextResponse.json({ provider: provider.name, finalGames: finalGames.length, pickemGraded, survivorGraded, fantasyGraded });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Grading failed' }, { status: 500 });
  }
}
