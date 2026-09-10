'use client';
import {useEffect,useRef,useState} from 'react';
import {LiveKitRoom,VideoConference,useConnectionState,useLocalParticipant} from '@livekit/components-react';
import {ConnectionState,Track} from 'livekit-client';
import '@livekit/components-styles';
import {createClient} from '@/lib/supabase/client';

function CommissionerMediaControls(){
 const {localParticipant,isScreenShareEnabled}=useLocalParticipant();
 const connectionState=useConnectionState(),connected=connectionState===ConnectionState.Connected;
 const [isCameraEnabled,setCameraEnabled]=useState(false),[isMicrophoneEnabled,setMicrophoneEnabled]=useState(false),[micLevel,setMicLevel]=useState(0);
 const [busy,setBusy]=useState(''),[error,setError]=useState('');
 const videoRef=useRef<HTMLVideoElement>(null);
 const cameraStream=useRef<MediaStream|null>(null),microphoneStream=useRef<MediaStream|null>(null),meterFrame=useRef<number>(0),audioContext=useRef<AudioContext|null>(null);
 useEffect(()=>()=>{cameraStream.current?.getTracks().forEach(t=>t.stop());microphoneStream.current?.getTracks().forEach(t=>t.stop());cancelAnimationFrame(meterFrame.current);void audioContext.current?.close()},[]);
 function stopMeter(){cancelAnimationFrame(meterFrame.current);void audioContext.current?.close();audioContext.current=null;setMicLevel(0)}
 function startMeter(stream:MediaStream){
  stopMeter();const context=new AudioContext();audioContext.current=context;const analyser=context.createAnalyser();analyser.fftSize=256;context.createMediaStreamSource(stream).connect(analyser);const values=new Uint8Array(analyser.frequencyBinCount);
  const read=()=>{analyser.getByteFrequencyData(values);setMicLevel(values.reduce((a,b)=>a+b,0)/values.length);meterFrame.current=requestAnimationFrame(read)};read();
 }
 async function toggle(kind:'camera'|'microphone'|'screen'){
  setBusy(kind);setError('');
  try{
   if(kind==='camera'){
    if(isCameraEnabled){const track=cameraStream.current?.getVideoTracks()[0];if(track)await localParticipant.unpublishTrack(track,true);cameraStream.current=null;if(videoRef.current)videoRef.current.srcObject=null;setCameraEnabled(false)}
    else{if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera access is not supported in this browser.');const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});const track=stream.getVideoTracks()[0];if(!track)throw new Error('No camera was found.');await localParticipant.publishTrack(track,{source:Track.Source.Camera});cameraStream.current=stream;setCameraEnabled(true);requestAnimationFrame(()=>{if(videoRef.current){videoRef.current.srcObject=stream;void videoRef.current.play()}})}
   }
   if(kind==='microphone'){
    if(isMicrophoneEnabled){const track=microphoneStream.current?.getAudioTracks()[0];if(track)await localParticipant.unpublishTrack(track,true);microphoneStream.current=null;stopMeter();setMicrophoneEnabled(false)}
    else{if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone access is not supported in this browser.');const stream=await navigator.mediaDevices.getUserMedia({video:false,audio:{echoCancellation:true,noiseSuppression:true}});const track=stream.getAudioTracks()[0];if(!track)throw new Error('No microphone was found.');await localParticipant.publishTrack(track,{source:Track.Source.Microphone});microphoneStream.current=stream;startMeter(stream);setMicrophoneEnabled(true)}
   }
   if(kind==='screen')await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
  }catch(e){const detail=e instanceof Error?`${e.name}: ${e.message}`:'Unknown device error';setError(`${detail}. Check the camera and microphone permissions beside the browser address.`)}finally{setBusy('')}
 }
 return <>
  {isCameraEnabled&&<div className="commissionerCameraPreview"><video ref={videoRef} autoPlay playsInline muted/><b>YOUR CAMERA · LIVE</b></div>}
  <div className="commissionerMediaControls">
   <div className={`roomConnection ${connected?'connected':''}`}>{connected?'LIVE ROOM CONNECTED':`LIVE ROOM ${connectionState.toUpperCase()}…`}</div>
   <button type="button" className={isMicrophoneEnabled?'on':''} disabled={!!busy||!connected} onClick={()=>toggle('microphone')}>{isMicrophoneEnabled?'Mute Microphone':'Turn On Microphone'}</button>
   {isMicrophoneEnabled&&<div className="micLive"><i style={{width:`${Math.max(8,Math.min(100,micLevel))}%`}}/><b>MIC LIVE</b></div>}
   <button type="button" className={isCameraEnabled?'on':''} disabled={!!busy||!connected} onClick={()=>toggle('camera')}>{isCameraEnabled?'Turn Off Camera':'Turn On Camera'}</button>
   <button type="button" className={isScreenShareEnabled?'on':''} disabled={!!busy||!connected} onClick={()=>toggle('screen')}>{isScreenShareEnabled?'Stop Sharing':'Share Screen'}</button>
   {error&&<span>{error}</span>}
  </div>
 </>
}

export default function LiveBroadcast({asHost}:{asHost:boolean}){
 const [cfg,setCfg]=useState<{token:string;url:string;role:'host'|'viewer'}|null>(null),[error,setError]=useState(''),[roomError,setRoomError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true;(async()=>{try{setCfg(null);setError('');setRoomError('');const {data}=await createClient().auth.getSession();const headers=new Headers({'content-type':'application/json'});if(data.session?.access_token)headers.set('authorization',`Bearer ${data.session.access_token}`);const r=await fetch('/api/livekit/token',{method:'POST',headers,body:JSON.stringify({roomName:'degens-live',asHost})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Live broadcast unavailable');if(asHost&&j.role!=='host')throw new Error('Commissioner broadcast permissions were not granted. Please refresh and try again.');if(active)setCfg(j)}catch(e){if(active)setError(e instanceof Error?e.message:'Live broadcast unavailable')}})();return()=>{active=false}},[asHost,attempt]);
 if(error)return <div className="videoPlaceholder"><span>LIVE VIDEO</span><strong>Broadcast not connected</strong><p>{error}</p></div>;
 if(!cfg)return <div className="videoPlaceholder"><strong>Connecting live room…</strong></div>;
 return <div className="livekitWrap" data-lk-theme="default"><LiveKitRoom key={cfg.token} token={cfg.token} serverUrl={cfg.url} connect video={false} audio={false} onConnected={()=>setRoomError('')} onError={e=>setRoomError(`${e.name}: ${e.message}`)} onDisconnected={reason=>setRoomError(`Live room disconnected${reason?`: ${String(reason)}`:''}`)}><VideoConference/>{cfg.role==='host'&&<CommissionerMediaControls/>}</LiveKitRoom>{roomError&&<div className="roomConnectionError"><b>LIVE ROOM NOT CONNECTED</b><span>{roomError}</span><button type="button" onClick={()=>setAttempt(x=>x+1)}>Retry Connection</button></div>}</div>
}
