import { NextResponse } from 'next/server';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { requireCommissioner } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req:Request){
 try{
  const body=await req.json();
  if(process.env.NEXT_PUBLIC_SUPABASE_URL){
   const {user}=await requireCommissioner(); const s=createAdminClient();
   let prize:any=null;
   if(body.prizeId){const r=await s.from('prizes').select('*').eq('id',body.prizeId).single();if(r.error)throw r.error;prize=r.data}
   let eligible:any[]=[];
   if(prize){let q=s.from('entries').select('id,entry_name,user_id,pool_id,status,payment_status').eq('payment_status',prize.eligibility?.payment_status||'PAID');if(prize.pool_id)q=q.eq('pool_id',prize.pool_id);if(prize.eligibility?.entry_status)q=q.eq('status',prize.eligibility.entry_status);const r=await q;if(r.error)throw r.error;eligible=(r.data||[]).map(e=>({id:e.id,name:e.entry_name}));}
   else eligible=Array.isArray(body.eligibleEntries)?body.eligibleEntries:[];
   if(!eligible.length)return NextResponse.json({error:'No eligible paid/active entries.'},{status:400});
   const entropy=randomBytes(32), n=BigInt('0x'+entropy.toString('hex')), index=Number(n%BigInt(eligible.length)), randomValue=entropy.toString('hex');
   const snapshot=eligible; const drawId=randomUUID(); const verificationHash=createHash('sha256').update(`${drawId}|${JSON.stringify(snapshot)}|${randomValue}`).digest('hex');
   const winner=eligible[index];
   if(prize){const {error}=await s.from('prize_draws').insert({id:drawId,prize_id:prize.id,winner_entry_id:winner.id,eligible_snapshot:snapshot,random_value:randomValue,verification_hash:verificationHash,drawn_at:new Date().toISOString()});if(error)throw error;await s.from('commissioner_audit_log').insert({commissioner_id:user.id,action:'PRIZE_DRAW',entity_type:'prize_draw',entity_id:drawId,after_state:{prize_id:prize.id,winner,eligible_count:eligible.length,verification_hash:verificationHash}})}
   return NextResponse.json({drawId,winner,eligibleCount:eligible.length,randomValue,verificationHash,algorithm:'CSPRNG randomBytes(32) modulo eligibleCount',persisted:!!prize});
  }
  const eligible=Array.isArray(body.eligibleEntries)?body.eligibleEntries:[]; if(!eligible.length)return NextResponse.json({error:'No eligible entries.'},{status:400});
  const entropy=randomBytes(32),n=BigInt('0x'+entropy.toString('hex')),index=Number(n%BigInt(eligible.length)),randomValue=entropy.toString('hex');const drawId=randomUUID();const verificationHash=createHash('sha256').update(`${drawId}|${JSON.stringify(eligible)}|${randomValue}`).digest('hex');
  return NextResponse.json({drawId,winner:eligible[index],eligibleCount:eligible.length,randomValue,verificationHash,algorithm:'CSPRNG randomBytes(32) modulo eligibleCount',persisted:false});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Draw failed.'},{status:403})}
}
