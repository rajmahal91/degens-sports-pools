import { createAdminClient } from '@/lib/supabase/admin';

type Sport='NHL'|'NBA';
type Event={date:string;completed:boolean;teams:string[];scores:number[]};

async function scoreboard(sport:Sport,season:number):Promise<Event[]> {
  const league=sport==='NHL'?'hockey/nhl':'basketball/nba';
  const response=await fetch(`https://site.api.espn.com/apis/site/v2/sports/${league}/scoreboard?dates=${season}&seasontype=3`,{cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error(`ESPN ${sport} playoff scoreboard returned ${response.status}.`);
  const payload=await response.json();
  return (payload.events||[]).flatMap((event:any)=>{
    const competition=event.competitions?.[0];
    const competitors=(competition?.competitors||[]).filter((team:any)=>team.team?.abbreviation).sort((a:any,b:any)=>a.homeAway==='away'?-1:b.homeAway==='away'?1:0);
    if(competitors.length!==2)return [];
    return [{date:String(event.date),completed:Boolean(event.status?.type?.completed),teams:competitors.map((team:any)=>String(team.team.abbreviation)),scores:competitors.map((team:any)=>Number(team.score))}];
  });
}

export async function syncPlayoffBrackets() {
  const admin=createAdminClient();
  const {data:pools,error}=await admin.from('pools').select('id,sport,season').eq('pool_type','BRACKET').eq('is_active',true).in('sport',['NHL','NBA']);
  if(error)throw error;
  const groups=new Map<string,Event[]>();
  for(const pool of pools||[]){const key=`${pool.sport}-${pool.season}`;if(!groups.has(key))groups.set(key,await scoreboard(pool.sport as Sport,Number(pool.season)));}
  const results=[];
  for(const pool of pools||[]){
    const events=groups.get(`${pool.sport}-${pool.season}`)||[];
    const {data:matchups}=await admin.from('bracket_matchups').select('*').eq('pool_id',pool.id).order('round_number').order('matchup_number');
    let updated=0;
    for(const matchup of matchups||[]){
      if(matchup.winner_team||!matchup.team1||!matchup.team2)continue;
      const series=events.filter(event=>event.completed&&new Set(event.teams).has(matchup.team1)&&new Set(event.teams).has(matchup.team2));
      const wins=new Map<string,number>();
      for(const event of series){const winner=event.scores[0]===event.scores[1]?null:event.scores[0]>event.scores[1]?event.teams[0]:event.teams[1];if(winner)wins.set(winner,(wins.get(winner)||0)+1);}
      const winner=[matchup.team1,matchup.team2].find(team=>(wins.get(team)||0)>=4);
      if(!winner)continue;
      const length=series.length;
      const {error:updateError}=await admin.from('bracket_matchups').update({winner_team:winner,actual_series_length:length}).eq('id',matchup.id);
      if(updateError)throw updateError;
      const roundPoints=({1:1,2:2,3:4,4:8} as Record<number,number>)[Number(matchup.round_number)]||1;
      const {data:picks}=await admin.from('bracket_picks').select('id,predicted_winner,predicted_series_length').eq('matchup_id',matchup.id);
      for(const pick of picks||[])await admin.from('bracket_picks').update({points_awarded:(pick.predicted_winner===winner?roundPoints:0)+(pick.predicted_winner===winner&&pick.predicted_series_length===length?1:0)}).eq('id',pick.id);
      if(matchup.next_matchup_id)await admin.from('bracket_matchups').update(matchup.advance_to_slot===1?{team1:winner}:{team2:winner}).eq('id',matchup.next_matchup_id);
      updated++;
    }
    results.push({poolId:pool.id,sport:pool.sport,season:pool.season,updated});
  }
  return {results};
}
