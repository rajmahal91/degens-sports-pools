import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

export async function GET(req:Request){
 try{
  const {supabase,user}=await requireUser(); const u=new URL(req.url); const entryId=u.searchParams.get('entryId'),roundId=u.searchParams.get('roundId');
  if(!entryId||!roundId)return NextResponse.json({error:'entryId and roundId are required'},{status:400});
  const {data:entry}=await supabase.from('entries').select('id,user_id,pool_id,payment_status,status').eq('id',entryId).single();
  if(!entry||entry.user_id!==user.id)return NextResponse.json({error:'Forbidden'},{status:403});
  const {data:round}=await supabase.from('rounds').select('id,sequence,pool_id').eq('id',roundId).single();
  const {data:pool}=await supabase.from('pools').select('season,contest_type,sport').eq('id',entry.pool_id).single();
  if(!round||!pool||round.pool_id!==entry.pool_id||pool.contest_type!=='PLAYOFF_FANTASY')return NextResponse.json({error:'Invalid fantasy round'},{status:400});
  const {data:games}=await supabase.from('games').select('home_team_code,away_team_code,starts_at,status').eq('sport','NFL').eq('season',pool.season).eq('week',round.sequence);
  const teams=[...new Set((games||[]).flatMap(g=>[g.home_team_code,g.away_team_code]))];
  let athletes:any[]=[]; if(teams.length){const r=await supabase.from('athletes').select('id,full_name,team_code,position,active').eq('sport','NFL').eq('active',true).in('team_code',teams).in('position',['QB','RB','WR','TE']).order('position').order('full_name');athletes=r.data||[]}
  const {data:used}=await supabase.from('playoff_fantasy_picks').select('athlete_id').eq('entry_id',entryId); const usedIds=new Set((used||[]).map(x=>x.athlete_id));
  const kickoff=new Map((games||[]).flatMap(g=>[[g.home_team_code,g.starts_at],[g.away_team_code,g.starts_at]]));
  return NextResponse.json({players:athletes.map(a=>({...a,used:usedIds.has(a.id),kickoff:kickoff.get(a.team_code)||null})),entryEligible:entry.status==='ACTIVE'&&entry.payment_status==='PAID'});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to load players'},{status:401})}
}
