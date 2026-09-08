import {NextResponse} from 'next/server';
import {requireCommissioner} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
type Team={code:string;seed?:number;conference?:string};
export async function POST(req:Request){
 try{await requireCommissioner();const {poolId,sport,teams}=await req.json() as {poolId:string;sport:'NHL'|'NBA';teams:Team[]};if(!poolId||!['NHL','NBA'].includes(sport)||!Array.isArray(teams)||teams.length!==16)return NextResponse.json({error:'poolId, sport, and exactly 16 ordered teams are required.'},{status:400});
  const rows:any[]=[];for(let i=0;i<8;i++)rows.push({id:`${poolId}-r1-${i+1}`,pool_id:poolId,sport,round_number:1,conference:teams[i*2].conference||null,team_a_code:teams[i*2].code,team_b_code:teams[i*2+1].code,seed_a:teams[i*2].seed||null,seed_b:teams[i*2+1].seed||null,next_matchup_id:`${poolId}-r2-${Math.floor(i/2)+1}`,advance_to_slot:i%2===0?'A':'B'});
  for(let i=0;i<4;i++)rows.push({id:`${poolId}-r2-${i+1}`,pool_id:poolId,sport,round_number:2,conference:i<2?teams[0].conference||null:teams[8].conference||null,team_a_code:'TBD',team_b_code:'TBD',next_matchup_id:`${poolId}-r3-${Math.floor(i/2)+1}`,advance_to_slot:i%2===0?'A':'B'});
  for(let i=0;i<2;i++)rows.push({id:`${poolId}-r3-${i+1}`,pool_id:poolId,sport,round_number:3,conference:i===0?teams[0].conference||null:teams[8].conference||null,team_a_code:'TBD',team_b_code:'TBD',next_matchup_id:`${poolId}-r4-1`,advance_to_slot:i===0?'A':'B'});
  rows.push({id:`${poolId}-r4-1`,pool_id:poolId,sport,round_number:4,conference:'Final',team_a_code:'TBD',team_b_code:'TBD'});
  const s=createAdminClient();const {error}=await s.from('bracket_matchups').upsert(rows,{onConflict:'id'});if(error)throw error;return NextResponse.json({ok:true,matchups:rows.length});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not create bracket'},{status:403})}
}
