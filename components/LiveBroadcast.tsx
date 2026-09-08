'use client';
import {useEffect,useState} from 'react';
import {LiveKitRoom,VideoConference} from '@livekit/components-react';
import '@livekit/components-styles';

export default function LiveBroadcast({asHost}:{asHost:boolean}){
 const [cfg,setCfg]=useState<{token:string;url:string}|null>(null),[error,setError]=useState('');
 useEffect(()=>{fetch('/api/livekit/token',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({roomName:'degens-live',asHost})}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||'LiveKit unavailable');setCfg(j)}).catch(e=>setError(e.message))},[asHost]);
 if(error)return <div className="videoPlaceholder"><span>LIVE VIDEO</span><strong>Broadcast not connected</strong><p>{error}</p></div>;
 if(!cfg)return <div className="videoPlaceholder"><strong>Connecting live room…</strong></div>;
 return <div className="livekitWrap" data-lk-theme="default"><LiveKitRoom token={cfg.token} serverUrl={cfg.url} connect video={asHost} audio={asHost}><VideoConference/></LiveKitRoom></div>
}
