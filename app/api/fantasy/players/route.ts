import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

export async function GET(req:Request){
 try{
  const {supabase,user}=await requireUser(); const u=new URL(req.url); const entryId=u.searchParams.get('entryId'),roundId=u.searchParams.get('roundId');
  if(!entryId||!roundId)return NextResponse.json({error:'entryId and roundId are required'},{status:400});
  const {data:entry}=await supabase.from('entries').select('id,user_id,pool_id,entry_status').eq('id',entryId).single();
  if(!entry||entry.user_id!==user.id)return NextResponse.json({error:'Forbidden'},{status:403});
  const {data:round}=await supabase.from('rounds').select('id,round_order,label,pool_id').eq('id',roundId).single();
  const {data:pool}=await supabase.from('pools').select('season,pool_type,sport').eq('id',entry.pool_id).single();
  if(!round||!pool||round.pool_id!==entry.pool_id||pool.pool_type!=='PLAYOFF_FANTASY')return NextResponse.json({error:'Invalid fantasy round'},{status:400});
  const {data:allGames}=await supabase.from('games').select('home_team,away_team,kickoff_at,status,round_label,week').eq('sport','NFL').eq('season',pool.season);
  const label=String(round.label||'').toLowerCase();
  const games=(allGames||[]).filter((g:any)=>String(g.round_label||'').toLowerCase()===label || Number(g.week)===Number(round.round_order)&&String(g.round_label||'').toLowerCase().includes(label.split(' ')[0]||'__never__'));
  const teams=[...new Set(games.flatMap((g:any)=>[g.home_team,g.away_team]).filter(Boolean))];
  let athletes:any[]=[]; if(teams.length){const r=await supabase.from('athletes').select('id,name,team_code,position,active').eq('sport','NFL').eq('active',true).in('team_code',teams).in('position',['QB','RB','WR','TE']).order('position').order('name');athletes=r.data||[]}
  const {data:used}=await supabase.from('playoff_fantasy_picks').select('athlete_id,round_id,slot').eq('entry_id',entryId); const usedIds=new Set((used||[]).filter((x:any)=>!(x.round_id===roundId&&x.slot===u.searchParams.get('slot'))).map(x=>x.athlete_id));
  const kickoff=new Map(games.flatMap((g:any)=>[[g.home_team,g.kickoff_at],[g.away_team,g.kickoff_at]]));
  const startsAt=games.map((g:any)=>new Date(g.kickoff_at).getTime()).filter(Number.isFinite).sort((a:number,b:number)=>a-b)[0];
  return NextResponse.json({round:{id:round.id,label:round.label,order:round.round_order,startsAt:Number.isFinite(startsAt)?new Date(startsAt).toISOString():null,locked:Number.isFinite(startsAt)&&startsAt<=Date.now()},teams,players:athletes.map(a=>({...a,full_name:a.name,used:usedIds.has(a.id),kickoff:kickoff.get(a.team_code)||null})),entryEligible:entry.entry_status==='ACTIVE'});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to load players'},{status:401})}
}
