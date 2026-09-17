const CACHE='sports-syndicate-shell-v2';
const ASSETS=['/icons/sports-syndicate-192.png','/icons/sports-syndicate-512.png','/icons/sports-syndicate-maskable-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json()||{};}catch{data={body:event.data?.text()||'You have an update from Sports Syndicate Fantasy.'};}
  const title=data.title||'Sports Syndicate Fantasy';
  const options={body:data.body||'Open Sports Syndicate Fantasy for details.',icon:data.icon||'/icons/sports-syndicate-192.png',badge:'/icons/sports-syndicate-192.png',tag:data.tag||'sports-syndicate-update',renotify:true,data:{url:data.url||'/'},actions:data.actions||[]};
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',event=>{event.notification.close();const target=new URL(event.notification.data?.url||'/',self.location.origin).href;event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{const existing=list.find(client=>client.url.startsWith(self.location.origin));return existing?existing.navigate(target).then(client=>client?.focus()):clients.openWindow(target);}));});
self.addEventListener('fetch',event=>{const request=event.request;const url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;if(url.pathname.startsWith('/icons/')||url.pathname.startsWith('/_next/static/'))event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));return response;})));});
