import { NextResponse } from 'next/server';
import { AccessToken, TrackSource } from 'livekit-server-sdk';
import { randomUUID } from 'crypto';
import { requireCommissioner, requireUser } from '@/lib/auth';

export async function POST(req:Request){
 try{
  const body=await req.json().catch(()=>({})); const asHost=!!body.asHost; const auth=asHost?await requireCommissioner():await requireUser(); const user=auth.user;
  const roomName=String(body.roomName||'degens-live'); const key=process.env.LIVEKIT_API_KEY,secret=process.env.LIVEKIT_API_SECRET,url=process.env.LIVEKIT_URL||process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if(!key||!secret||!url)return NextResponse.json({error:'LiveKit is not configured.'},{status:503});
  // A unique identity prevents a viewer preview tab from replacing the
  // commissioner's publishing session (LiveKit identities are room-unique).
  const identity=`${user.id}:${asHost?'host':'viewer'}:${randomUUID()}`;
  const token=new AccessToken(key,secret,{identity,name:user.email||'Degens Player',ttl:'2h'});
  token.addGrant({roomJoin:true,room:roomName,canPublish:asHost,canSubscribe:true,canPublishData:asHost,canPublishSources:asHost?[TrackSource.CAMERA,TrackSource.MICROPHONE,TrackSource.SCREEN_SHARE,TrackSource.SCREEN_SHARE_AUDIO]:[]});
  console.info('[api/livekit/token] issued',{userId:user.id,roomName,role:asHost?'host':'viewer',canPublish:asHost});
  return NextResponse.json({token:await token.toJwt(),url,roomName,role:asHost?'host':'viewer'});
 }catch(e){console.error('[api/livekit/token] failed',{error:e instanceof Error?e.message:String(e)});return NextResponse.json({error:e instanceof Error?e.message:'Unable to create token'},{status:401})}
}
