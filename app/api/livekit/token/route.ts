import { NextResponse } from 'next/server';
import { AccessToken, TrackSource } from 'livekit-server-sdk';
import { randomUUID } from 'crypto';
import { requireCommissioner, requireUser } from '@/lib/auth';

function cleanCredential(raw:string|undefined,name:string){
 if(!raw)return '';
 const value=raw.trim().replace(new RegExp(`^${name}\\s*=\\s*`,'i'),'').replace(/^['"]|['"]$/g,'');
 return value.split(/\s+/)[0];
}

function cleanLiveKitUrl(raw:string|undefined){
 if(!raw)return '';
 // Accept either the bare URL or an accidentally pasted LIVEKIT_URL= line.
 // Removing whitespace also repairs URLs copied across a visual line wrap.
 const compact=raw.replace(/\s+/g,'');
 const match=compact.match(/wss:\/\/[a-z0-9.-]+(?::\d+)?/i);
 if(!match)return '';
 try{const parsed=new URL(match[0]);return parsed.protocol==='wss:'?parsed.origin:''}catch{return ''}
}

export async function POST(req:Request){
 try{
  const body=await req.json().catch(()=>({})); const asHost=!!body.asHost; const auth=asHost?await requireCommissioner():await requireUser(); const user=auth.user;
  const roomName=String(body.roomName||'degens-live'); const key=cleanCredential(process.env.LIVEKIT_API_KEY,'LIVEKIT_API_KEY'),secret=cleanCredential(process.env.LIVEKIT_API_SECRET,'LIVEKIT_API_SECRET'),url=cleanLiveKitUrl(process.env.LIVEKIT_URL||process.env.NEXT_PUBLIC_LIVEKIT_URL)||'wss://degens-sports-pool-6nhxzczw.livekit.cloud';
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
