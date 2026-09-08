import { NextResponse } from 'next/server';
import { requireCommissioner } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req:Request){
 try{
  if(process.env.NEXT_PUBLIC_SUPABASE_URL) await requireCommissioner();
  const {matchupId,winnerCode,seriesGames}=await req.json();
  if(!matchupId||!winnerCode||!seriesGames) return NextResponse.json({error:'matchupId, winnerCode and seriesGames required'},{status:400});
  const s=createAdminClient(); const {data:m,error:me}=await s.from('bracket_matchups').select('*').eq('id',matchupId).single(); if(me||!m) throw me||new Error('Matchup not found');
  if(![m.team_a_code,m.team_b_code].includes(winnerCode)) return NextResponse.json({error:'Winner must be one of the matchup teams.'},{status:400});
  await s.from('bracket_matchups').update({winner_code:winnerCode,series_games:seriesGames}).eq('id',matchupId);
  const roundPoints={1:1,2:2,3:4,4:8}[Number(m.round_number) as 1|2|3|4]||1;
  const {data:picks}=await s.from('bracket_picks').select('id,predicted_winner,predicted_games').eq('matchup_id',matchupId);
  for(const p of picks||[]){const pts=(p.predicted_winner===winnerCode?roundPoints:0)+(p.predicted_winner===winnerCode&&p.predicted_games===seriesGames?1:0);await s.from('bracket_picks').update({points_awarded:pts,updated_at:new Date().toISOString()}).eq('id',p.id)}
  if(m.next_matchup_id&&m.advance_to_slot){const patch=m.advance_to_slot==='A'?{team_a_code:winnerCode}:{team_b_code:winnerCode};await s.from('bracket_matchups').update(patch).eq('id',m.next_matchup_id)}
  return NextResponse.json({ok:true,graded:(picks||[]).length,advancedTo:m.next_matchup_id||null});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not grade bracket'},{status:403})}
}
