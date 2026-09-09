import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

export async function POST(request:Request){
  try{
    const {supabase}=await requireUser();
    const {inviteCode,entryName}=await request.json();
    const code=String(inviteCode||'').trim().toUpperCase();
    const name=String(entryName||'').trim().slice(0,60);
    if(code.length<6||name.length<2) return NextResponse.json({error:'Enter a valid invite code and entry name.'},{status:400});
    const {data,error}=await supabase.rpc('join_league',{p_invite_code:code,p_entry_name:name});
    if(error) return NextResponse.json({error:error.message},{status:400});
    return NextResponse.json(data,{status:201});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:'Could not join league.'},{status:401});
  }
}
