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
  let eligible:any[]=[];
  if(prize.eligibility?.draw_list_mode==='MANUAL')eligible=(prize.eligibility.manual_entries||[]).map((e:any)=>({id:String(e.id),entry_name:String(e.name),user_id:null}));
  else{let q=s.from('entries').select('id,entry_name,user_id').eq('pool_id',prize.pool_id).eq('payment_status',prize.eligibility?.payment_status||'PAID');if(prize.eligibility?.entry_status)q=q.eq('entry_status',prize.eligibility.entry_status);const {data:raw,error}=await q;if(error)throw error;eligible=raw||[];
   if(prize.eligibility?.one_prize_per_entry){const {data:wins}=await s.from('prize_draws').select('winner_entry_id,prizes!inner(pool_id)').eq('prizes.pool_id',prize.pool_id);const won=new Set((wins||[]).map((x:any)=>x.winner_entry_id));eligible=eligible.filter(e=>!won.has(e.id))}}
  if(!eligible.length)return NextResponse.json({error:'No eligible paid, active entries.'},{status:400});
  const entropy=randomBytes(32),index=Number(BigInt('0x'+entropy.toString('hex'))%BigInt(eligible.length)),winner=eligible[index],drawId=randomUUID(),snapshot=eligible.map(e=>({id:e.id,name:e.entry_name})),randomValue=entropy.toString('hex');
  const verificationHash=createHash('sha256').update(`${drawId}|${JSON.stringify(snapshot)}|${randomValue}`).digest('hex');
  const manual=String(winner.id).startsWith('manual-');
  const {error:insertError}=await s.from('prize_draws').insert({id:drawId,prize_id:prize.id,winner_entry_id:manual?null:winner.id,original_winner_entry_id:manual?null:winner.id,winner_snapshot_id:winner.id,original_winner_snapshot_id:winner.id,winner_name:winner.entry_name,original_winner_name:winner.entry_name,eligible_snapshot:snapshot,random_value:randomValue,verification_hash:verificationHash,drawn_by:user.id,drawn_at:new Date().toISOString()});
  if(insertError){if(insertError.code==='23505')return NextResponse.json({error:'This prize has already been drawn.'},{status:409});throw insertError}
  await Promise.all([s.from('prizes').update({status:'AWARDED'}).eq('id',prize.id),s.from('commissioner_audit_log').insert({commissioner_id:user.id,action:'PRIZE_DRAW',entity_type:'prize_draw',entity_id:drawId,after_state:{prize_id:prize.id,winner:{id:winner.id,name:winner.entry_name},eligible_count:eligible.length,verification_hash:verificationHash}})]);
  return NextResponse.json({drawId,winner:{id:winner.id,name:winner.entry_name},winnerIndex:index,eligibleEntries:snapshot,eligibleCount:eligible.length,randomValue,verificationHash,algorithm:'CSPRNG randomBytes(32) modulo eligibleCount',persisted:true});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Draw failed.'},{status:403})}
}

export async function PATCH(req:Request){
 try{
  const {user}=await requireUser();const {drawId,winnerEntryId,reason}=await req.json();const s=createAdminClient();
  if(!drawId||!winnerEntryId||String(reason||'').trim().length<5)return NextResponse.json({error:'Choose a winner and enter a reason (at least 5 characters).'},{status:400});
  const {data:draw,error}=await s.from('prize_draws').select('*,prizes!inner(pool_id,pools!inner(organizations!inner(owner_user_id)))').eq('id',drawId).single();if(error||!draw)throw error||new Error('Draw not found.');
  const poolId=(draw as any).prizes.pool_id,{data:leagueRole}=await s.from('league_members').select('role').eq('pool_id',poolId).eq('user_id',user.id).eq('status','ACTIVE').maybeSingle();
  const owner=(draw as any).prizes.pools?.organizations?.owner_user_id===user.id;if(!owner&&!['COMMISSIONER','CO_COMMISSIONER'].includes(leagueRole?.role||''))return NextResponse.json({error:'Commissioner access required.'},{status:403});
  const candidate=(draw.eligible_snapshot as any[]).find(e=>e.id===winnerEntryId);if(!candidate)return NextResponse.json({error:'The replacement winner must have been eligible in the original draw.'},{status:400});
  const before={winner_entry_id:draw.winner_entry_id,winner_name:draw.winner_name,override_reason:draw.override_reason},manual=String(winnerEntryId).startsWith('manual-');
  const patch={winner_entry_id:manual?null:winnerEntryId,winner_snapshot_id:winnerEntryId,winner_name:candidate.name,override_reason:String(reason).trim().slice(0,500),overridden_at:new Date().toISOString(),overridden_by:user.id};
  const {error:updateError}=await s.from('prize_draws').update(patch).eq('id',drawId);if(updateError)throw updateError;
  await s.from('commissioner_audit_log').insert({commissioner_id:user.id,action:'PRIZE_WINNER_OVERRIDE',entity_type:'prize_draw',entity_id:drawId,before_state:before,after_state:{...patch,winner:candidate}});
  return NextResponse.json({ok:true,winner:candidate});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not edit winner.'},{status:403})}
}
