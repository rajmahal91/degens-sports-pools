'use client';

import { useEffect,useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

function decodeKey(value:string){
  const padding='='.repeat((4-value.length%4)%4);const binary=atob((value+padding).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(binary,char=>char.charCodeAt(0));
}

type NotificationStatus={configured:boolean;enabled:boolean;subscriptionCount:number;nativeTokens?:Array<{id:string;platform:string}>};

export default function NotificationSettings(){
  const [status,setStatus]=useState<NotificationStatus|null>(null);const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
  async function load(){
    try{const response=await fetch('/api/notifications/status');if(!response.ok)throw new Error();setStatus(await response.json());}catch{setStatus(null);}
  }
  useEffect(()=>{load();},[]);
  const native=Capacitor.isNativePlatform();
  const supported=native||(typeof window!=='undefined'&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window);
  async function enable(){
    setBusy(true);setMessage('');
    try{
      if(!supported)throw new Error('Push notifications are not supported by this browser.');
      if(native){
        const permission=await PushNotifications.requestPermissions();if(permission.receive!=='granted')throw new Error('Notifications were not enabled.');
        const token=await new Promise<string>(async(resolve,reject)=>{
          let settled=false;
          const finish=(callback:()=>void)=>{if(settled)return;settled=true;clearTimeout(timeout);void success.remove();void failure.remove();callback();};
          const success=await PushNotifications.addListener('registration',value=>finish(()=>resolve(value.value)));
          const failure=await PushNotifications.addListener('registrationError',error=>finish(()=>reject(new Error(error.error||'Native push registration failed.'))));
          const timeout=setTimeout(()=>finish(()=>reject(new Error('Native push registration timed out.'))),15000);
          try{await PushNotifications.register();}catch(error){finish(()=>reject(error));}
        });
        const response=await fetch('/api/notifications/native-subscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,platform:Capacitor.getPlatform()})});
        const body=await response.json();if(!response.ok)throw new Error(body.error||'Could not enable native notifications.');
        setMessage('Notifications are enabled on this device.');await load();return;
      }
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
      if(native){await fetch('/api/notifications/native-subscribe',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({platform:Capacitor.getPlatform()})});await PushNotifications.unregister();setMessage('Notifications are disabled on this device.');await load();return;}
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
  return <section className="notificationSettings"><span className="eyebrow">POOL ALERTS</span><h2>Push notifications</h2><p>Get Survivor and Pick’em deadline reminders, missed-pick alerts, eliminations, and weekly results.</p>{!supported&&<div className="warning">This browser does not support push notifications. On iPhone, add the app to your Home Screen first.</div>}{status&&!status.configured&&!native&&<div className="warning">Push delivery is not configured yet.</div>}{status?.enabled?<div className="notificationActions">{!native&&<button className="primary" type="button" disabled={busy} onClick={test}>{busy?'Sending…':'Send test notification'}</button>}<button className="secondary" type="button" disabled={busy} onClick={disable}>Disable notifications</button></div>:<button className="primary" type="button" disabled={busy||!supported||(!native&&status?.configured===false)} onClick={enable}>{busy?'Enabling…':'Enable notifications'}</button>}{native&&<small className="fieldHint">Native delivery requires APNs and Firebase credentials before the TestFlight and Play test builds.</small>}{message&&<div className={message.includes('enabled')||message.includes('disabled')||message.includes('sent')?'notice':'warning'}>{message}</div>}</section>;
}
