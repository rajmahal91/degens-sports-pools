'use client';
import {useEffect,useState} from 'react';
import {LiveKitRoom,VideoConference} from '@livekit/components-react';
import '@livekit/components-styles';
import {createClient} from '@/lib/supabase/client';

export default function LiveBroadcast({asHost}:{asHost:boolean}){
 const [cfg,setCfg]=useState<{token:string;url:string;role:'host'|'viewer'}|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;(async()=>{try{setCfg(null);setError('');const {data}=await createClient().auth.getSession();const headers=new Headers({'content-type':'application/json'});if(data.session?.access_token)headers.set('authorization',`Bearer ${data.session.access_token}`);const r=await fetch('/api/livekit/token',{method:'POST',headers,body:JSON.stringify({roomName:'degens-live',asHost})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Live broadcast unavailable');if(asHost&&j.role!=='host')throw new Error('Commissioner broadcast permissions were not granted. Please refresh and try again.');if(active)setCfg(j)}catch(e){if(active)setError(e instanceof Error?e.message:'Live broadcast unavailable')}})();return()=>{active=false}},[asHost]);
 if(error)return <div className="videoPlaceholder"><span>LIVE VIDEO</span><strong>Broadcast not connected</strong><p>{error}</p></div>;
 if(!cfg)return <div className="videoPlaceholder"><strong>Connecting live room…</strong></div>;
 return <div className="livekitWrap" data-lk-theme="default"><LiveKitRoom key={cfg.token} token={cfg.token} serverUrl={cfg.url} connect video={cfg.role==='host'} audio={cfg.role==='host'}><VideoConference/></LiveKitRoom></div>
}
