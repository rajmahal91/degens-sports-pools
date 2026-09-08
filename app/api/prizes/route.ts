import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(){
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL)return NextResponse.json({prizes:[]});
 const userClient=await createClient(); const {data:{user}}=await userClient.auth.getUser(); const admin=createAdminClient();
 const {data:prizes,error}=await admin.from('prizes').select('*, prize_draws(id,winner_entry_id,drawn_at,verification_hash)').order('scheduled_draw_at'); if(error)return NextResponse.json({error:error.message},{status:400});
 const result=[];
 for(const prize of prizes||[]){
  let q=admin.from('entries').select('id,entry_name,user_id,status,payment_status').eq('payment_status',prize.eligibility?.payment_status||'PAID');
  if(prize.pool_id)q=q.eq('pool_id',prize.pool_id); if(prize.eligibility?.entry_status)q=q.eq('status',prize.eligibility.entry_status);
  const {data:eligible}=await q; result.push({...prize,eligible_count:(eligible||[]).length,my_eligible_entries:(eligible||[]).filter(e=>e.user_id===user?.id).map(e=>e.entry_name)});
 }
 return NextResponse.json({prizes:result});
}
