import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { recordPickReceipt } from '@/lib/picks/audit';

const validSlots = new Set(['QB','RB1','RB2','WR1','WR2','TE']);

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const { entryId, roundId, slot, athleteId } = await request.json();
    if (!entryId || !roundId || !slot || !athleteId || !validSlots.has(slot)) return NextResponse.json({ error: 'Invalid lineup selection' }, { status: 400 });
    const { data: entry } = await supabase.from('entries').select('id,user_id,pool_id,entry_status').eq('id', entryId).single();
    if (!entry || entry.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (entry.entry_status !== 'ACTIVE') return NextResponse.json({ error: 'This fantasy entry is no longer active.' }, { status: 409 });
    const [{ data: pool }, { data: round }, { data: athlete }] = await Promise.all([
      supabase.from('pools').select('id,pool_type,season').eq('id', entry.pool_id).single(),
      supabase.from('rounds').select('id,pool_id,label,round_order').eq('id', roundId).single(),
      supabase.from('athletes').select('id,name,team_code,position').eq('id', athleteId).single(),
    ]);
    if (!pool || pool.pool_type !== 'PLAYOFF_FANTASY' || !round || round.pool_id !== entry.pool_id || !athlete) {
      return NextResponse.json({ error: 'Invalid playoff fantasy selection.' }, { status: 400 });
    }
    const slotPosition = slot === 'QB' ? 'QB' : slot.startsWith('RB') ? 'RB' : slot.startsWith('WR') ? 'WR' : 'TE';
    if (athlete.position !== slotPosition) return NextResponse.json({ error: `${athlete.name} is not eligible for the ${slot} slot.` }, { status: 400 });
    const { data: games } = await supabase.from('games').select('home_team,away_team,round_label,kickoff_at').eq('sport', 'NFL').eq('season', pool.season).eq('round_label', round.label);
    const firstKickoff = (games || []).map((game: any) => new Date(game.kickoff_at).getTime()).filter(Number.isFinite).sort((a: number, b: number) => a - b)[0];
    if (Number.isFinite(firstKickoff) && firstKickoff <= Date.now()) return NextResponse.json({ error: `${round.label} picks are locked once the round begins.` }, { status: 409 });
    const playoffTeams = new Set((games || []).flatMap((game: any) => [game.home_team, game.away_team]));
    if (!playoffTeams.has(athlete.team_code)) return NextResponse.json({ error: `${athlete.name} is not on a team in the ${round.label} round.` }, { status: 400 });
    const { data: existing } = await supabase.from('playoff_fantasy_picks').select('id,round_id,slot,athlete_id').eq('entry_id', entryId);
    const duplicate = (existing || []).find((pick: any) => pick.athlete_id === athleteId && !(pick.round_id === roundId && pick.slot === slot));
    if (duplicate) return NextResponse.json({ error: `${athlete.name} has already been used by this entry and cannot be selected again.` }, { status: 409 });
    const { data, error } = await supabase.from('playoff_fantasy_picks').upsert({ entry_id: entryId, round_id: roundId, slot, athlete_id: athleteId }, { onConflict: 'entry_id,round_id,slot' }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const previous = (existing || []).find((pick: any) => pick.round_id === roundId && pick.slot === slot);
    const receipt = await recordPickReceipt({
      userId: user.id,
      entryId,
      poolId: entry.pool_id,
      pickType: 'PLAYOFF_FANTASY',
      pickKey: `round-${roundId}-${slot}`,
      action: previous ? 'CHANGED' : 'SUBMITTED',
      beforeState: previous,
      afterState: data,
      submittedAt: data.submitted_at,
    });
    return NextResponse.json({ pick: data, receipt });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 401 });
  }
}
