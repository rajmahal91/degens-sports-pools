'use client';
import {useEffect,useState} from 'react';
import {LiveKitRoom,VideoConference,useLocalParticipant} from '@livekit/components-react';
import '@livekit/components-styles';
import {createClient} from '@/lib/supabase/client';

function CommissionerMediaControls(){
 const {localParticipant,isCameraEnabled,isMicrophoneEnabled,isScreenShareEnabled}=useLocalParticipant();
 const [busy,setBusy]=useState(''),[error,setError]=useState('');
 async function toggle(kind:'camera'|'microphone'|'screen'){
  setBusy(kind);setError('');
  try{
   if(kind==='camera')await localParticipant.setCameraEnabled(!isCameraEnabled);
   if(kind==='microphone')await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
   if(kind==='screen')await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
  }catch(e){setError(e instanceof Error?e.message:'Your browser blocked this device. Use the site icon beside the address to allow access.')}finally{setBusy('')}
 }
 return <div className="commissionerMediaControls">
  <button type="button" className={isMicrophoneEnabled?'on':''} disabled={!!busy} onClick={()=>toggle('microphone')}>{isMicrophoneEnabled?'Mute Microphone':'Turn On Microphone'}</button>
  <button type="button" className={isCameraEnabled?'on':''} disabled={!!busy} onClick={()=>toggle('camera')}>{isCameraEnabled?'Turn Off Camera':'Turn On Camera'}</button>
  <button type="button" className={isScreenShareEnabled?'on':''} disabled={!!busy} onClick={()=>toggle('screen')}>{isScreenShareEnabled?'Stop Sharing':'Share Screen'}</button>
  {error&&<span>{error}</span>}
 </div>
}

export default function LiveBroadcast({asHost}:{asHost:boolean}){
 const [cfg,setCfg]=useState<{token:string;url:string;role:'host'|'viewer'}|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;(async()=>{try{setCfg(null);setError('');const {data}=await createClient().auth.getSession();const headers=new Headers({'content-type':'application/json'});if(data.session?.access_token)headers.set('authorization',`Bearer ${data.session.access_token}`);const r=await fetch('/api/livekit/token',{method:'POST',headers,body:JSON.stringify({roomName:'degens-live',asHost})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Live broadcast unavailable');if(asHost&&j.role!=='host')throw new Error('Commissioner broadcast permissions were not granted. Please refresh and try again.');if(active)setCfg(j)}catch(e){if(active)setError(e instanceof Error?e.message:'Live broadcast unavailable')}})();return()=>{active=false}},[asHost]);
 if(error)return <div className="videoPlaceholder"><span>LIVE VIDEO</span><strong>Broadcast not connected</strong><p>{error}</p></div>;
 if(!cfg)return <div className="videoPlaceholder"><strong>Connecting live room…</strong></div>;
 return <div className="livekitWrap" data-lk-theme="default"><LiveKitRoom key={cfg.token} token={cfg.token} serverUrl={cfg.url} connect video={false} audio={false}><VideoConference/>{cfg.role==='host'&&<CommissionerMediaControls/>}</LiveKitRoom></div>
}
