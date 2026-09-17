'use client';

import { useEffect,useState } from 'react';

function decodeKey(value:string){
  const padding='='.repeat((4-value.length%4)%4);const binary=atob((value+padding).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(binary,char=>char.charCodeAt(0));
}

type NotificationStatus={configured:boolean;enabled:boolean;subscriptionCount:number};

export default function NotificationSettings(){
  const [status,setStatus]=useState<NotificationStatus|null>(null);const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
  async function load(){
    try{const response=await fetch('/api/notifications/status');if(!response.ok)throw new Error();setStatus(await response.json());}catch{setStatus(null);}
  }
  useEffect(()=>{load();},[]);
  const supported=typeof window!=='undefined'&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
  async function enable(){
    setBusy(true);setMessage('');
    try{
      if(!supported)throw new Error('Push notifications are not supported by this browser.');
      if(Notification.permission==='denied')throw new Error('Notifications are blocked. Open your browser settings for Sports Syndicate Fantasy and allow notifications.');
      const permission=await Notification.requestPermission();
      if(permission!=='granted')throw new Error('Notifications were not enabled.');
      const keyResponse=await fetch('/api/notifications/vapid-public-key');const keyBody=await keyResponse.json();if(!keyResponse.ok)throw new Error(keyBody.error||'Push notifications are not configured yet.');
      const registration=await navigator.serviceWorker.ready;
      const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(keyBody.publicKey)});
      const response=await fetch('/api/notifications/subscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({subscription:subscription.toJSON()})});
      const body=await response.json();if(!response.ok)throw new Error(body.error||'Could not enable notifications.');
      setMessage('Notifications are enabled on this device.');await load();
    }catch(error){setMessage(error instanceof Error?error.message:'Could not enable notifications.');}finally{setBusy(false);}
  }
  async function disable(){
    setBusy(true);setMessage('');
    try{
      const registration=await navigator.serviceWorker.ready;const subscription=await registration.pushManager.getSubscription();
      if(subscription)await fetch('/api/notifications/subscribe',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:subscription.endpoint})});
      await subscription?.unsubscribe();setMessage('Notifications are disabled on this device.');await load();
    }catch{setMessage('Could not disable notifications.');}finally{setBusy(false);}
  }
  async function test(){
    setBusy(true);setMessage('');
    try{const response=await fetch('/api/notifications/test',{method:'POST'});const body=await response.json();if(!response.ok)throw new Error(body.error||'Could not send a test notification.');setMessage('Test notification sent.');}
    catch(error){setMessage(error instanceof Error?error.message:'Could not send a test notification.');}finally{setBusy(false);}
  }
  return <section className="notificationSettings"><span className="eyebrow">POOL ALERTS</span><h2>Push notifications</h2><p>Get Survivor and Pick’em deadline reminders, missed-pick alerts, eliminations, and weekly results.</p>{!supported&&<div className="warning">This browser does not support push notifications. On iPhone, add the app to your Home Screen first.</div>}{status&&!status.configured&&<div className="warning">Push delivery is not configured yet.</div>}{status?.enabled?<div className="notificationActions"><button className="primary" type="button" disabled={busy} onClick={test}>{busy?'Sending…':'Send test notification'}</button><button className="secondary" type="button" disabled={busy} onClick={disable}>Disable notifications</button></div>:<button className="primary" type="button" disabled={busy||!supported||status?.configured===false} onClick={enable}>{busy?'Enabling…':'Enable notifications'}</button>}{message&&<div className={message.includes('enabled')||message.includes('disabled')||message.includes('sent')?'notice':'warning'}>{message}</div>}</section>;
}
