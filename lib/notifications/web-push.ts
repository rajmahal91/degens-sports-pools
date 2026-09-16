import { createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign } from 'node:crypto';

export type StoredPushSubscription={endpoint:string;p256dh:string;auth:string};

function base64Url(value:Buffer|string){
  const buffer=Buffer.isBuffer(value)?value:Buffer.from(value);
  return buffer.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

function fromBase64Url(value:string){
  const normalized=value.replace(/-/g,'+').replace(/_/g,'/');
  return Buffer.from(normalized+'='.repeat((4-normalized.length%4)%4),'base64');
}

function hmac(key:Buffer,value:Buffer|string){return createHmac('sha256',key).update(value).digest();}

function hkdfExpand(secret:Buffer,info:Buffer,length:number){
  let previous=Buffer.alloc(0);let output=Buffer.alloc(0);
  for(let counter=1;output.length<length;counter++){
    previous=hmac(secret,Buffer.concat([previous,info,Buffer.from([counter])]));
    output=Buffer.concat([output,previous]);
  }
  return output.subarray(0,length);
}

function vapidPrivateKey(){
  const privateBytes=fromBase64Url(process.env.VAPID_PRIVATE_KEY||'');
  const publicBytes=fromBase64Url(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||'');
  if(privateBytes.length!==32||publicBytes.length!==65)throw new Error('Push notifications are not configured with valid VAPID keys.');
  const key=createPrivateKey({key:{kty:'EC',crv:'P-256',d:base64Url(privateBytes),x:base64Url(publicBytes.subarray(1,33)),y:base64Url(publicBytes.subarray(33,65))},format:'jwk'});
  return {key,publicBytes};
}

function vapidAuthorization(endpoint:string){
  const {key,publicBytes}=vapidPrivateKey();
  const header=base64Url(JSON.stringify({typ:'JWT',alg:'ES256'}));
  const claims=base64Url(JSON.stringify({aud:new URL(endpoint).origin,exp:Math.floor(Date.now()/1000)+12*60*60,sub:process.env.VAPID_SUBJECT||'mailto:admin@sports-syndicate.app'}));
  const input=`${header}.${claims}`;
  const signature=sign('sha256',Buffer.from(input),{key,dsaEncoding:'ieee-p1363'});
  return {authorization:`vapid t=${input}.${base64Url(signature)}, k=${base64Url(publicBytes)}`};
}

function encryptPayload(subscription:StoredPushSubscription,payload:string){
  const clientPublic=fromBase64Url(subscription.p256dh);
  const authSecret=fromBase64Url(subscription.auth);
  if(clientPublic.length!==65||authSecret.length!==16)throw new Error('Invalid push subscription keys.');
  const ephemeral=createECDH('prime256v1');
  ephemeral.generateKeys();
  const ephemeralPublic=ephemeral.getPublicKey();
  const sharedSecret=ephemeral.computeSecret(clientPublic);
  const salt=randomBytes(16);
  const prkKey=hmac(authSecret,sharedSecret);
  const keyInfo=Buffer.concat([Buffer.from('WebPush: info\0'),clientPublic,ephemeralPublic]);
  const ikm=hkdfExpand(prkKey,keyInfo,32);
  const prk=hmac(salt,ikm);
  const cek=hkdfExpand(prk,Buffer.from('Content-Encoding: aes128gcm\0'),16);
  const nonce=hkdfExpand(prk,Buffer.from('Content-Encoding: nonce\0'),12);
  // The Web Push aes128gcm content encoding uses one padding delimiter byte.
  const cipher=createCipheriv('aes-128-gcm',cek,nonce);
  const encrypted=Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload),Buffer.from([2])])),cipher.final(),cipher.getAuthTag()]);
  const recordSize=Buffer.alloc(4);recordSize.writeUInt32BE(4096);
  return Buffer.concat([salt,recordSize,Buffer.from([ephemeralPublic.length]),ephemeralPublic,encrypted]);
}

export function pushIsConfigured(){
  return Boolean(process.env.VAPID_PRIVATE_KEY&&process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
}

export function publicVapidKey(){
  if(!pushIsConfigured())return null;
  vapidPrivateKey();
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||null;
}

export async function sendWebPush(subscription:StoredPushSubscription,payload:Record<string,unknown>){
  const body=encryptPayload(subscription,JSON.stringify(payload));
  const {authorization}=vapidAuthorization(subscription.endpoint);
  const response=await fetch(subscription.endpoint,{method:'POST',headers:{Authorization:authorization,TTL:'120',Urgency:'high','Content-Type':'application/octet-stream','Content-Encoding':'aes128gcm'},body,signal:AbortSignal.timeout(12000)});
  if(!response.ok){
    const error=new Error(`Push provider returned ${response.status}.`);
    (error as Error&{status?:number}).status=response.status;
    throw error;
  }
}
