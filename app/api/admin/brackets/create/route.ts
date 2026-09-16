import {NextResponse} from 'next/server';
import {requireCommissioner} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {randomUUID} from 'crypto';
type Team={code:string;seed?:number;conference?:string};
export async function POST(req:Request){
 try{await requireCommissioner();const {poolId,sport,teams}=await req.json() as {poolId:string;sport:'NHL'|'NBA';teams:Team[]};if(!poolId||!['NHL','NBA'].includes(sport)||!Array.isArray(teams)||teams.length!==16)return NextResponse.json({error:'poolId, sport, and exactly 16 ordered teams are required.'},{status:400});
  const ids=Array.from({length:15},()=>randomUUID()),offsets=[0,8,12,14],rows:any[]=[];
  for(let round=1;round<=4;round++)for(let number=1;number<=16/2**round;number++)rows.push({id:ids[rows.length],pool_id:poolId,round_number:round,matchup_number:number,team1:round===1?teams[(number-1)*2].code:null,team2:round===1?teams[(number-1)*2+1].code:null,next_matchup_id:round<4?ids[offsets[round]+Math.ceil(number/2)-1]:null,advance_to_slot:round<4?(number%2?1:2):null});
  const s=createAdminClient();const {error}=await s.from('bracket_matchups').upsert(rows,{onConflict:'id'});if(error)throw error;return NextResponse.json({ok:true,matchups:rows.length});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not create bracket'},{status:403})}
}
