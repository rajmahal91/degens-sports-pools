'use client';

import { useEffect,useState } from 'react';

interface InstallPromptEvent extends Event{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>}

export default function InstallApp(){
  const [prompt,setPrompt]=useState<InstallPromptEvent|null>(null);const [open,setOpen]=useState(false);const [hidden,setHidden]=useState(true);
  useEffect(()=>{
    if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>undefined);
    const standalone=window.matchMedia('(display-mode: standalone)').matches||('standalone' in navigator&&(navigator as Navigator&{standalone?:boolean}).standalone===true);
    if(standalone)return;
    setHidden(false);
    const capture=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPromptEvent)};
    window.addEventListener('beforeinstallprompt',capture);
    return()=>window.removeEventListener('beforeinstallprompt',capture);
  },[]);
  if(hidden)return null;
  const install=async()=>{if(!prompt){setOpen(true);return;}await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')setHidden(true);setPrompt(null)};
  return <><button className="installAppButton" onClick={install}>Install App</button>{open&&<div className="installBackdrop" role="presentation" onClick={()=>setOpen(false)}><section className="installDialog" role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={event=>event.stopPropagation()}><button className="installClose" aria-label="Close installation instructions" onClick={()=>setOpen(false)}>×</button><span>DEGENS SPORTS POOLS</span><h2 id="install-title">Add Degens to your phone</h2><div><h3>iPhone or iPad</h3><p>Open this page in Safari, tap the <b>Share</b> button, then choose <b>Add to Home Screen</b> and tap <b>Add</b>.</p></div><div><h3>Android</h3><p>Open the browser menu and choose <b>Install app</b> or <b>Add to Home screen</b>.</p></div></section></div>}</>;
}
