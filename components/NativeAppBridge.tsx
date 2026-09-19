'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar,Style } from '@capacitor/status-bar';

const WEB_ORIGIN='https://degens-sports-pools-iota.vercel.app';

function routeFromNativeUrl(value:string){
  try{
    const url=new URL(value);
    if(url.origin===WEB_ORIGIN)return `${url.pathname}${url.search}${url.hash}`;
    if(url.protocol==='sportssyndicate:')return `${url.pathname||'/'}${url.search}${url.hash}`;
  }catch{return null;}
  return null;
}

export default function NativeAppBridge(){
  useEffect(()=>{
    if(!Capacitor.isNativePlatform())return;
    document.documentElement.classList.add('nativeApp');
    void StatusBar.setStyle({style:Style.Light});
    if(Capacitor.getPlatform()==='android')void StatusBar.setBackgroundColor({color:'#0b0e13'});
    void SplashScreen.hide();
    const listeners=[
      App.addListener('appUrlOpen',({url})=>{const route=routeFromNativeUrl(url);if(route)window.location.assign(route);}),
      App.addListener('backButton',({canGoBack})=>{if(canGoBack)window.history.back();else if(Capacitor.getPlatform()==='android')void App.minimizeApp();}),
    ];
    return()=>{document.documentElement.classList.remove('nativeApp');void Promise.all(listeners.map(async listener=>(await listener).remove()));};
  },[]);
  return null;
}
