import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request:Request){
  try{
    const {user}=await requireUser();
    const {inviteCode,entryName}=await request.json();
    const code=String(inviteCode||'').trim().toUpperCase();
    const name=String(entryName||'').trim().slice(0,60);
    if(code.length<6||name.length<2) return NextResponse.json({error:'Enter a valid invite code and entry name.'},{status:400});
    const admin=createAdminClient();
    const codeHash=createHash('sha256').update(code).digest('hex');
    const {data:invite}=await admin.from('league_invitations').select('id,pool_id,max_uses,use_count,expires_at,is_active').eq('code_hash',codeHash).single();
    if(!invite||!invite.is_active||(invite.expires_at&&new Date(invite.expires_at)<=new Date())||(invite.max_uses&&invite.use_count>=invite.max_uses)){
      return NextResponse.json({error:'This invite code is invalid or expired.'},{status:400});
    }
    const {data:pool}=await admin.from('pools').select('id,name,max_entries_per_user').eq('id',invite.pool_id).single();
    if(!pool) return NextResponse.json({error:'League not found.'},{status:404});
    const {count}=await admin.from('entries').select('id',{count:'exact',head:true}).eq('pool_id',pool.id).eq('user_id',user.id);
    if((count||0)>=(pool.max_entries_per_user||1)) return NextResponse.json({error:'You have reached this league’s entry limit.'},{status:400});
    const {error:memberError}=await admin.from('league_members').upsert({pool_id:pool.id,user_id:user.id,role:'PLAYER',status:'ACTIVE'},{onConflict:'pool_id,user_id'});
    if(memberError) return NextResponse.json({error:memberError.message},{status:400});
    const {data:entry,error:entryError}=await admin.from('entries').insert({pool_id:pool.id,user_id:user.id,entry_name:name,payment_status:'UNPAID',entry_status:'ACTIVE'}).select('*').single();
    if(entryError) return NextResponse.json({error:entryError.message},{status:400});
    await admin.from('league_invitations').update({use_count:invite.use_count+1}).eq('id',invite.id).eq('use_count',invite.use_count);
    return NextResponse.json({pool,entry},{status:201});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:'Could not join league.'},{status:401});
  }
}
