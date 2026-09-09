import {NextResponse} from 'next/server';
import {createHash,randomBytes,randomUUID} from 'crypto';
import {requireUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
export async function POST(req:Request){
 try{
  const {user}=await requireUser();const {prizeId}=await req.json();const s=createAdminClient();
  if(!prizeId)return NextResponse.json({error:'Select a prize.'},{status:400});
  const {data:prize,error:prizeError}=await s.from('prizes').select('*,pools!inner(organization_id,organizations!inner(owner_user_id))').eq('id',prizeId).single();if(prizeError||!prize)throw prizeError||new Error('Prize not found.');
  const {data:leagueRole}=await s.from('league_members').select('role').eq('pool_id',prize.pool_id).eq('user_id',user.id).eq('status','ACTIVE').maybeSingle();
  const owner=(prize as any).pools?.organizations?.owner_user_id===user.id;if(!owner&&!['COMMISSIONER','CO_COMMISSIONER'].includes(leagueRole?.role||''))return NextResponse.json({error:'Commissioner access required.'},{status:403});
  const {data:existing}=await s.from('prize_draws').select('id').eq('prize_id',prize.id).maybeSingle();if(existing)return NextResponse.json({error:'This prize has already been drawn.'},{status:409});
  let q=s.from('entries').select('id,entry_name,user_id').eq('pool_id',prize.pool_id).eq('payment_status',prize.eligibility?.payment_status||'PAID');if(prize.eligibility?.entry_status)q=q.eq('entry_status',prize.eligibility.entry_status);
  const {data:raw,error}=await q;if(error)throw error;let eligible=raw||[];
  if(prize.eligibility?.one_prize_per_entry){const {data:wins}=await s.from('prize_draws').select('winner_entry_id,prizes!inner(pool_id)').eq('prizes.pool_id',prize.pool_id);const won=new Set((wins||[]).map((x:any)=>x.winner_entry_id));eligible=eligible.filter(e=>!won.has(e.id))}
  if(!eligible.length)return NextResponse.json({error:'No eligible paid, active entries.'},{status:400});
  const entropy=randomBytes(32),index=Number(BigInt('0x'+entropy.toString('hex'))%BigInt(eligible.length)),winner=eligible[index],drawId=randomUUID(),snapshot=eligible.map(e=>({id:e.id,name:e.entry_name})),randomValue=entropy.toString('hex');
  const verificationHash=createHash('sha256').update(`${drawId}|${JSON.stringify(snapshot)}|${randomValue}`).digest('hex');
  const {error:insertError}=await s.from('prize_draws').insert({id:drawId,prize_id:prize.id,winner_entry_id:winner.id,eligible_snapshot:snapshot,random_value:randomValue,verification_hash:verificationHash,drawn_by:user.id,drawn_at:new Date().toISOString()});
  if(insertError){if(insertError.code==='23505')return NextResponse.json({error:'This prize has already been drawn.'},{status:409});throw insertError}
  await Promise.all([s.from('prizes').update({status:'AWARDED'}).eq('id',prize.id),s.from('commissioner_audit_log').insert({commissioner_id:user.id,action:'PRIZE_DRAW',entity_type:'prize_draw',entity_id:drawId,after_state:{prize_id:prize.id,winner:{id:winner.id,name:winner.entry_name},eligible_count:eligible.length,verification_hash:verificationHash}})]);
  return NextResponse.json({drawId,winner:{id:winner.id,name:winner.entry_name},winnerIndex:index,eligibleEntries:snapshot,eligibleCount:eligible.length,randomValue,verificationHash,algorithm:'CSPRNG randomBytes(32) modulo eligibleCount',persisted:true});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Draw failed.'},{status:403})}
}
