import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { requireCommissioner, requireUser } from '@/lib/auth';

export async function POST(req:Request){
 try{
  const body=await req.json().catch(()=>({})); const asHost=!!body.asHost; const auth=asHost?await requireCommissioner():await requireUser(); const user=auth.user;
  const roomName=String(body.roomName||'degens-live'); const key=process.env.LIVEKIT_API_KEY,secret=process.env.LIVEKIT_API_SECRET,url=process.env.LIVEKIT_URL||process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if(!key||!secret||!url)return NextResponse.json({error:'LiveKit is not configured.'},{status:503});
  const token=new AccessToken(key,secret,{identity:user.id,name:user.email||'Degens Player',ttl:'2h'});
  token.addGrant({roomJoin:true,room:roomName,canPublish:asHost,canSubscribe:true,canPublishData:asHost});
  return NextResponse.json({token:await token.toJwt(),url,roomName,role:asHost?'host':'viewer'});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to create token'},{status:401})}
}
